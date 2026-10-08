/**
 * GET /api/debug/net-income-analysis
 *
 * Diagnostic : pourquoi 23600 ≠ 15000 ?
 * Montre exactement quelles déductions OCR réduisent le revenu net
 * et permet de les invalider via DELETE.
 *
 * ⚠️ DEV ONLY
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, taxYears,
  incomeEntries, deductionEntries, taxCalculations,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

function fmt(cents: number | null | undefined) {
  if (!cents) return "0,00 $";
  return (cents / 100).toFixed(2) + " $";
}

const NET_INCOME_DEDUCTION_CATEGORIES = new Set([
  "rrsp", "union_dues", "childcare", "moving_expenses",
  "employment_expenses", "carrying_charges",
]);

const PAYROLL_CREDIT_RE = /(?:cotisations?|contributions?).*(?:rrq|rpc|qpp|cpp|rqap|qpip|ae|assurance[- ]emploi)|(?:rrq|rpc|qpp|cpp)\s*\/\s*(?:rrq|rpc|qpp|cpp)|(?:t4|rl[- ]?1).*(?:case|box|caisse)\s*(?:16|18|b|c)\b|(?:case|box)\s*(?:16|18|b|c)\b.*(?:t4|rl[- ]?1)/i;
const FEDERAL_WITHHELD_RE = /impôt sur le revenu retenu|impôt fédéral|federal income tax withheld|income tax deducted/i;
const PROVINCIAL_WITHHELD_RE = /impôt du québec|impôt provincial|provincial income tax withheld|provincial tax withheld/i;

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select({ id: taxProfiles.id, province: taxProfiles.province, fiscalResidence: taxProfiles.fiscalResidence })
    .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [taxReturn] = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);
  if (!taxReturn) return NextResponse.json({ error: "Aucun dossier" }, { status: 404 });

  const allIncomes = await db.select().from(incomeEntries)
    .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, taxReturn.id), eq(incomeEntries.isValidated, true)));

  const allDeductions = await db.select().from(deductionEntries)
    .where(and(eq(deductionEntries.userId, userId), eq(deductionEntries.taxReturnId, taxReturn.id), eq(deductionEntries.isValidated, true)));

  const [calc] = await db.select({
    totalIncomeCents: taxCalculations.totalIncomeCents,
    netIncomeCents: taxCalculations.netIncomeCents,
    taxableIncomeCents: taxCalculations.taxableIncomeCents,
    calculatedAt: taxCalculations.calculatedAt,
  }).from(taxCalculations)
    .where(and(eq(taxCalculations.userId, userId), eq(taxCalculations.taxReturnId, taxReturn.id)))
    .orderBy(desc(taxCalculations.calculatedAt)).limit(1);

  const totalIncomeCents = allIncomes.reduce((s, i) => s + (i.amountCents ?? 0), 0);

  // Exactly what the calculate route does
  const taxableDeductions = allDeductions.filter(d =>
    !FEDERAL_WITHHELD_RE.test(d.description ?? "") &&
    !PROVINCIAL_WITHHELD_RE.test(d.description ?? "") &&
    !PAYROLL_CREDIT_RE.test(d.description ?? "") &&
    NET_INCOME_DEDUCTION_CATEGORIES.has(d.category ?? "")
  );

  const totalTaxableDeductionsCents = taxableDeductions.reduce((s, d) => s + (d.amountCents ?? 0), 0);

  // Entries that do NOT reduce net income (for reference)
  const excludedDeductions = allDeductions.filter(d => !taxableDeductions.find(t => t.id === d.id));

  return NextResponse.json({
    taxReturnId: taxReturn.id,
    province: profile.fiscalResidence ?? profile.province ?? "QC",

    // ── Revenus
    incomes: {
      total_cents: totalIncomeCents,
      total: fmt(totalIncomeCents),
      entries: allIncomes.map(i => ({
        id: i.id,
        category: i.category,
        amount: fmt(i.amountCents),
        amountCents: i.amountCents,
        description: i.description,
        sourceType: i.sourceType,
      })),
    },

    // ── Déductions qui réduisent le revenu net (→ ligne 23600)
    taxable_deductions: {
      total_cents: totalTaxableDeductionsCents,
      total: fmt(totalTaxableDeductionsCents),
      entries: taxableDeductions.map(d => ({
        id: d.id,
        category: d.category,
        amount: fmt(d.amountCents),
        amountCents: d.amountCents,
        description: d.description,
        sourceType: d.sourceType,
        sourceDocumentId: d.sourceDocumentId,
        verdict: d.sourceType === "validated_ocr"
          ? "⚠️ OCR AUTO-VALIDÉ — vérifier si ce montant est correct sur le feuillet"
          : "✅ Manuel / confirmé",
      })),
    },

    // ── Déductions exclues (ne réduisent PAS 23600)
    excluded_deductions: {
      count: excludedDeductions.length,
      entries: excludedDeductions.map(d => ({
        id: d.id,
        category: d.category,
        amount: fmt(d.amountCents),
        description: d.description,
        reason: FEDERAL_WITHHELD_RE.test(d.description ?? "") ? "retenue_fédérale"
          : PROVINCIAL_WITHHELD_RE.test(d.description ?? "") ? "retenue_provinciale"
          : PAYROLL_CREDIT_RE.test(d.description ?? "") ? "cotisation_paie"
          : "categorie_non_deductible",
      })),
    },

    // ── Calcul théorique
    theoretical: {
      "15000_totalRevenu": fmt(totalIncomeCents),
      "21200_to_26600_deductions": fmt(totalTaxableDeductionsCents),
      "23600_revenuNet": fmt(totalIncomeCents - totalTaxableDeductionsCents),
    },

    // ── Dernier calcul moteur
    last_engine_calc: calc ? {
      calculatedAt: calc.calculatedAt,
      totalIncomeCents: calc.totalIncomeCents,
      netIncomeCents: calc.netIncomeCents,
      taxableIncomeCents: calc.taxableIncomeCents,
      total: fmt(calc.totalIncomeCents),
      net: fmt(calc.netIncomeCents),
      taxable: fmt(calc.taxableIncomeCents),
      matches_theory: Math.abs((calc.netIncomeCents ?? 0) - (totalIncomeCents - totalTaxableDeductionsCents)) < 100,
    } : null,

    // ── Diagnostic
    diagnosis: {
      ocr_deductions_suspect: taxableDeductions.filter(d => d.sourceType === "validated_ocr").map(d => ({
        id: d.id,
        category: d.category,
        amount: fmt(d.amountCents),
        description: d.description,
        action: `DELETE /api/debug/net-income-analysis/${d.id} pour invalider cette déduction`,
      })),
      total_ocr_deductions: fmt(
        taxableDeductions.filter(d => d.sourceType === "validated_ocr").reduce((s, d) => s + (d.amountCents ?? 0), 0)
      ),
      expected_23600_if_no_ocr_deductions: fmt(
        totalIncomeCents - taxableDeductions.filter(d => d.sourceType !== "validated_ocr").reduce((s, d) => s + (d.amountCents ?? 0), 0)
      ),
    },
  });
}

/**
 * DELETE /api/debug/net-income-analysis/[entryId]
 * Invalide une déduction spécifique (isValidated=false)
 */
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const url = new URL(req.url);
  const entryId = url.searchParams.get("id");
  if (!entryId) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const [profile] = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Invalider la déduction (appartient à cet utilisateur)
  const updated = await db
    .update(deductionEntries)
    .set({ isValidated: false })
    .where(and(
      eq(deductionEntries.id, entryId),
      eq(deductionEntries.userId, userId),
    ))
    .returning({ id: deductionEntries.id, category: deductionEntries.category, amountCents: deductionEntries.amountCents });

  if (updated.length === 0) {
    return NextResponse.json({ error: "Entrée introuvable ou non autorisée" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    invalidated: updated[0],
    message: `Déduction ${fmt(updated[0].amountCents)} (${updated[0].category}) invalidée. Relancez /api/tax-engine/calculate pour mettre à jour.`,
  });
}
