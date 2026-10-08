import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxReturns, taxProfiles, taxYears,
  incomeEntries, deductionEntries, creditEntries, taxCalculations,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculate } from "@/lib/tax-engine/engine";
import type { TaxEngineInput } from "@/lib/tax-engine/types";

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { taxReturnId } = body;
  if (!taxReturnId) return NextResponse.json({ error: "taxReturnId requis" }, { status: 400 });

  const profile = await db.select({ id: taxProfiles.id, province: taxProfiles.province, fiscalResidence: taxProfiles.fiscalResidence, pancanadianData: taxProfiles.pancanadianData })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile[0]) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const taxReturn = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId })
    .from(taxReturns)
    .where(and(eq(taxReturns.id, taxReturnId), eq(taxReturns.profileId, profile[0].id)))
    .limit(1);
  if (!taxReturn[0]) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

  const taxYear = await db.select({ year: taxYears.year }).from(taxYears)
    .where(eq(taxYears.id, taxReturn[0].taxYearId)).limit(1);
  if (!taxYear[0]) return NextResponse.json({ error: "Année introuvable" }, { status: 404 });

  const year = taxYear[0].year;
  const province = (profile[0].fiscalResidence ?? profile[0].province ?? "QC") as string;
  const pancanadian = (() => {
    const raw = profile[0].pancanadianData;
    if (!raw) return {} as Record<string, unknown>;
    if (typeof raw === "string") { try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; } }
    return (raw as Record<string, unknown>) ?? {};
  })();

  // DONNÉES VALIDÉES UNIQUEMENT — règle absolue du Tax Engine
  const incomes = await db.select().from(incomeEntries)
    .where(and(eq(incomeEntries.userId, clerkUserId), eq(incomeEntries.taxReturnId, taxReturnId), eq(incomeEntries.isValidated, true)));

  const deductions = await db.select().from(deductionEntries)
    .where(and(eq(deductionEntries.userId, clerkUserId), eq(deductionEntries.taxReturnId, taxReturnId), eq(deductionEntries.isValidated, true)));

  const credits = await db.select().from(creditEntries)
    .where(and(eq(creditEntries.userId, clerkUserId), eq(creditEntries.taxReturnId, taxReturnId), eq(creditEntries.isValidated, true)));

  // Les retenues des feuillets sont conservées comme entrées auditables, mais
  // ne sont ni un revenu ni une déduction. Elles alimentent les lignes 43700/451.
  const federalWithheldFromSlips = deductions
    .filter(d => /impôt fédéral|federal income tax withheld|income tax deducted/i.test(d.description ?? ""))
    .reduce((sum, d) => sum + (d.amountCents ?? 0), 0);
  const provincialWithheldFromSlips = deductions
    .filter(d => /impôt du québec|provincial income tax withheld|provincial tax withheld/i.test(d.description ?? ""))
    .reduce((sum, d) => sum + (d.amountCents ?? 0), 0);
  const taxableDeductions = deductions.filter(d =>
    !/impôt fédéral|federal income tax withheld|income tax deducted|impôt du québec|provincial income tax withheld|provincial tax withheld/i.test(d.description ?? "")
  );
  const answers = (pancanadian.answers ?? pancanadian.questionnaireAnswers ?? pancanadian) as Record<string, unknown>;
  const earnedIncomeCents = incomes.filter(i => i.category === "employment" || i.category === "self_employment").reduce((sum, i) => sum + (i.amountCents ?? 0), 0);

  // ACT/CWB 2025 — calculé automatiquement pour tout résident avec revenu d'emploi éligible.
  // Le questionnaire peut désactiver via answers.cwb_opt_out === true.
  // Source officielle : ARC 5005-S6 (2025), Revenu Québec.
  // INTERDIT : hardcoder les montants du test de régression.
  const cwbOptOut = [answers.cwb_opt_out].some(value => value === true || value === "true");
  let cwbCents = 0;
  if (!cwbOptOut && earnedIncomeCents > 0) {
    if (province === "QC") {
      // ─── 5005-S6 Québec 2025 ──────────────────────────────────────────────
      // Seuils 2025 pour les résidents du Québec (Schedule 6 QC)
      // Célibataire : phase-in à 27% au-delà de 3 000 $, max 1 590 $
      //               réduction à 15% au-delà de 26 149 $
      // Avec conjoint/famille : phase-in à 27% au-delà de 3 000 $, max 2 739 $
      //               réduction à 15% au-delà de 32 227 $
      const isCouple = answers.maritalStatus === "married" || answers.maritalStatus === "common_law" || answers.maritalStatus === "marie" || answers.maritalStatus === "union_de_fait";
      const cwbMaxQC = isCouple ? 273900 : 159000;               // max en cents
      const cwbPhaseInThresholdQC = 300000;                       // 3 000 $
      const cwbReductionThresholdQC = isCouple ? 3222700 : 2614900; // 32 227 $ ou 26 149 $
      const cwbPhaseIn = Math.min(
        cwbMaxQC,
        Math.max(0, earnedIncomeCents - cwbPhaseInThresholdQC) * 27 / 100
      );
      const cwbReduction = Math.max(0, earnedIncomeCents - cwbReductionThresholdQC) * 15 / 100;
      cwbCents = Math.max(0, Math.round(cwbPhaseIn - cwbReduction));
    } else {
      // ─── Formule fédérale générique (hors QC) ───────────────────────────
      const isCouple = answers.maritalStatus === "married" || answers.maritalStatus === "common_law";
      const cwbMax = isCouple ? 281300 : 163300;
      const cwbReductionThreshold = isCouple ? 3063900 : 2685500;
      const cwbPhaseIn = Math.min(cwbMax, Math.max(0, earnedIncomeCents - 300000) * 27 / 100);
      cwbCents = Math.max(0, Math.round(cwbPhaseIn - Math.max(0, earnedIncomeCents - cwbReductionThreshold) * 15 / 100));
    }
  }

  const input: TaxEngineInput = {
    taxYear: year,
    province: province as TaxEngineInput["province"],
    incomes: incomes.map((i) => ({
      category: i.category,
      amountCents: i.amountCents ?? 0,
      sourceType: (i.sourceType as "validated_ocr" | "manual" | "profile"),
      employerName: i.employerName ?? undefined,
      description: i.description ?? undefined,
    })),
    deductions: taxableDeductions.map((d) => ({
      category: d.category,
      amountCents: d.amountCents ?? 0,
      sourceType: (d.sourceType as "validated_ocr" | "manual"),
      description: d.description ?? undefined,
    })),
    credits: [
      ...credits.map((c) => ({
      category: c.category,
      claimedAmountCents: c.claimedAmountCents ?? 0,
      sourceType: (c.sourceType as "validated_ocr" | "manual"),
      description: c.description ?? undefined,
      isRefundable: /remboursable|prestation|allocation|benefit|act_cwb|acfb/i.test(`${c.category} ${c.description ?? ""}`),
      })),
      ...(cwbCents > 0 ? [{ category: "other_credits" as const, claimedAmountCents: cwbCents, sourceType: "manual" as const, description: "Allocation canadienne pour les travailleurs (ACT/CWB) — ligne 45300", isRefundable: true }] : []),
    ],
    taxWithheldFederalCents: (body.taxWithheldFederalCents ?? 0) + federalWithheldFromSlips,
    taxWithheldProvincialCents: (body.taxWithheldProvincialCents ?? 0) + provincialWithheldFromSlips,
    hasSpouse: body.hasSpouse ?? false,
  };

  try {
    const result = calculate(input);

    const [saved] = await db.insert(taxCalculations).values({
      userId: clerkUserId,
      taxReturnId,
      taxYearId: taxReturn[0].taxYearId,
      status: "completed",
      totalIncomeCents: result.totalIncomeCents,
      netIncomeCents: result.netIncomeCents,
      taxableIncomeCents: result.taxableIncomeCents,
      federalTaxBeforeCreditsCents: result.federalTaxBeforeCreditsCents,
      federalNonRefundableCreditsCents: result.federalBasicPersonalCreditCents + result.federalOtherCreditsCents,
      federalRefundableCreditsCents: result.federalRefundableCreditsCents,
      federalTaxPayableCents: result.federalTaxPayableCents,
      federalTaxWithheldCents: result.federalTaxWithheldCents,
      federalBalanceCents: result.federalBalanceCents,
      provincialTaxBeforeCreditsCents: result.provincialTaxBeforeCreditsCents,
      provincialNonRefundableCreditsCents: result.provincialBasicPersonalCreditCents + result.provincialOtherCreditsCents,
      provincialRefundableCreditsCents: result.provincialRefundableCreditsCents,
      provincialTaxPayableCents: result.provincialTaxPayableCents,
      provincialTaxWithheldCents: result.provincialTaxWithheldCents,
      provincialBalanceCents: result.provincialBalanceCents,
      totalBalanceCents: result.totalBalanceCents,
      calculationDetails: JSON.stringify({ breakdown: result.breakdown, lines: result.lines, settlement: { line43500: result.federalLine43500Cents, line43700: result.federalLine43700Cents, line45300: result.federalLine45300Cents, line48200: result.federalLine48200Cents, line48400: result.federalLine48400Cents, line48500: result.federalLine48500Cents, status: result.federalSettlementStatus } }),
      calculationVersion: "2.0",
      rulesSnapshotVersion: result.rulesVersion,
      isPreliminary: true,
    }).returning();

    return NextResponse.json({
      calculationId: saved.id,
      result,
      warning: "RÉSULTATS PRÉLIMINAIRES — Aucune déclaration transmise.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur de calcul";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
