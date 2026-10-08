/**
 * GET /api/debug/tax-pipeline
 *
 * Endpoint de diagnostic complet : montre exactement ce qui est dans la DB
 * pour l'utilisateur connecté et identifie pourquoi les lignes 43700/45300/48200
 * affichent 0$.
 *
 * ⚠️ DEV ONLY — protégé par auth Clerk mais ne devrait pas être en prod
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, taxYears,
  incomeEntries, deductionEntries, creditEntries, taxCalculations,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

function fmt(cents: number | null | undefined) {
  if (!cents) return "0,00 $";
  return (Math.abs(cents) / 100).toFixed(2) + " $";
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // ── 1. Profil
  const [profile] = await db.select().from(taxProfiles)
    .where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const province = profile.fiscalResidence ?? profile.province ?? "QC";

  // ── 2. Dossier fiscal
  const [taxReturn] = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);

  const taxReturnId = taxReturn?.id ?? null;

  let taxYear = 2025;
  if (taxReturn?.taxYearId) {
    const [yr] = await db.select({ year: taxYears.year }).from(taxYears)
      .where(eq(taxYears.id, taxReturn.taxYearId)).limit(1);
    if (yr) taxYear = yr.year;
  }

  if (!taxReturnId) {
    return NextResponse.json({ error: "Aucun dossier fiscal trouvé", userId, province });
  }

  // ── 3. Toutes les entrées (validées ET non validées)
  const allIncomes = await db.select().from(incomeEntries)
    .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, taxReturnId)));

  const allDeductions = await db.select().from(deductionEntries)
    .where(and(eq(deductionEntries.userId, userId), eq(deductionEntries.taxReturnId, taxReturnId)));

  const allCredits = await db.select().from(creditEntries)
    .where(and(eq(creditEntries.userId, userId), eq(creditEntries.taxReturnId, taxReturnId)));

  // ── 4. Dernier calcul
  const [calc] = await db.select().from(taxCalculations)
    .where(and(eq(taxCalculations.userId, userId), eq(taxCalculations.taxReturnId, taxReturnId)))
    .orderBy(desc(taxCalculations.calculatedAt)).limit(1);

  // ── 5. Parser le settlement depuis calculationDetails
  let settlement: Record<string, number | string> = {};
  let calcDetails: Record<string, unknown> = {};
  if (calc?.calculationDetails) {
    try {
      const raw = typeof calc.calculationDetails === "string"
        ? JSON.parse(calc.calculationDetails)
        : calc.calculationDetails;
      calcDetails = raw as Record<string, unknown>;
      if (raw?.settlement) settlement = raw.settlement as Record<string, number | string>;
    } catch { /* no-op */ }
  }

  // ── 6. Identifier les entrées de retenue fédérale
  const federalWithheldEntries = allDeductions.filter(d =>
    /impôt fédéral|federal income tax withheld|income tax deducted/i.test(d.description ?? "")
  );
  const federalWithheldTotal = federalWithheldEntries.reduce((s, d) => s + (d.amountCents ?? 0), 0);

  const federalWithheldValidatedEntries = federalWithheldEntries.filter(d => d.isValidated);
  const federalWithheldValidatedTotal = federalWithheldValidatedEntries.reduce((s, d) => s + (d.amountCents ?? 0), 0);

  // ── 7. Identifier les entrées de retenue provinciale
  const provincialWithheldEntries = allDeductions.filter(d =>
    /impôt du québec|provincial income tax withheld|provincial tax withheld/i.test(d.description ?? "")
  );

  // ── 8. Parser pancanadianData pour les réponses questionnaire
  let pancanadianAnswers: Record<string, unknown> = {};
  try {
    const raw = typeof profile.pancanadianData === "string"
      ? JSON.parse(profile.pancanadianData)
      : profile.pancanadianData;
    const answers = (raw as Record<string, unknown>)?.answers
      ?? (raw as Record<string, unknown>)?.questionnaireAnswers
      ?? raw;
    pancanadianAnswers = (answers as Record<string, unknown>) ?? {};
  } catch { /* no-op */ }

  const cwbFlags = {
    c17: pancanadianAnswers.c17,
    act_cwb: pancanadianAnswers.act_cwb,
    cwb: pancanadianAnswers.cwb,
    cwb_opt_out: pancanadianAnswers.cwb_opt_out,
    maritalStatus: pancanadianAnswers.maritalStatus,
  };

  // ── 9. Revenu d'emploi (pour calcul CWB)
  const earnedIncomeValidated = allIncomes
    .filter(i => i.isValidated && (i.category === "employment" || i.category === "self_employment"))
    .reduce((s, i) => s + (i.amountCents ?? 0), 0);

  // ── 10. Simuler le calcul CWB avec la nouvelle logique (sans gate wantsCwb)
  const cwbOptOut = cwbFlags.cwb_opt_out === true || cwbFlags.cwb_opt_out === "true";
  let simulatedCwb = 0;
  if (!cwbOptOut && earnedIncomeValidated > 0 && province === "QC") {
    const isCouple = ["married", "common_law", "marie", "union_de_fait"].includes(String(cwbFlags.maritalStatus ?? ""));
    const cwbMaxQC = isCouple ? 273900 : 159000;
    const cwbPhaseIn = Math.min(cwbMaxQC, Math.max(0, earnedIncomeValidated - 300000) * 27 / 100);
    const cwbReduction = Math.max(0, earnedIncomeValidated - (isCouple ? 3222700 : 2614900)) * 15 / 100;
    simulatedCwb = Math.max(0, Math.round(cwbPhaseIn - cwbReduction));
  }

  // ── RÉSULTAT DIAGNOSTIC
  return NextResponse.json({
    // Contexte
    userId,
    taxReturnId,
    taxYear,
    province,
    profileName: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim(),

    // ── SECTION 1 : Entrées DB brutes
    db_entries: {
      incomes: {
        total: allIncomes.length,
        validated: allIncomes.filter(i => i.isValidated).length,
        list: allIncomes.map(i => ({
          id: i.id,
          category: i.category,
          amountCents: i.amountCents,
          amount: fmt(i.amountCents),
          isValidated: i.isValidated,
          description: i.description,
          sourceType: i.sourceType,
        })),
      },
      deductions: {
        total: allDeductions.length,
        validated: allDeductions.filter(d => d.isValidated).length,
        list: allDeductions.map(d => ({
          id: d.id,
          category: d.category,
          amountCents: d.amountCents,
          amount: fmt(d.amountCents),
          isValidated: d.isValidated,
          description: d.description,
          sourceType: d.sourceType,
        })),
      },
      credits: {
        total: allCredits.length,
        validated: allCredits.filter(c => c.isValidated).length,
        list: allCredits.map(c => ({
          id: c.id,
          category: c.category,
          amountCents: c.claimedAmountCents,
          amount: fmt(c.claimedAmountCents),
          isValidated: c.isValidated,
          description: c.description,
        })),
      },
    },

    // ── SECTION 2 : Détection retenue fédérale (T4 box 22 → ligne 43700)
    federal_withheld_detection: {
      regex_used: "/impôt fédéral|federal income tax withheld|income tax deducted/i",
      entries_matching: federalWithheldEntries.map(d => ({
        description: d.description,
        amountCents: d.amountCents,
        amount: fmt(d.amountCents),
        isValidated: d.isValidated,
      })),
      total_all: federalWithheldTotal,
      total_validated_only: federalWithheldValidatedTotal,
      diagnosis: federalWithheldEntries.length === 0
        ? "❌ AUCUNE entrée de retenue fédérale trouvée — T4 box 22 n'a pas été extrait ou description ne match pas"
        : federalWithheldValidatedEntries.length === 0
          ? "⚠️ Entrées trouvées mais NON VALIDÉES — calculate/route.ts filtre avec isValidated=true"
          : `✅ ${federalWithheldValidatedEntries.length} entrée(s) validée(s) — total: ${fmt(federalWithheldValidatedTotal)}`,
    },

    // ── SECTION 3 : Retenue provinciale (RL-1 case E → ligne 451)
    provincial_withheld_detection: {
      entries_matching: provincialWithheldEntries.map(d => ({
        description: d.description,
        amountCents: d.amountCents,
        isValidated: d.isValidated,
      })),
      diagnosis: provincialWithheldEntries.length === 0
        ? "❌ Aucune retenue provinciale (RL-1 case E)"
        : `${provincialWithheldEntries.length} entrée(s) — validated: ${provincialWithheldEntries.filter(d => d.isValidated).length}`,
    },

    // ── SECTION 4 : CWB / ACT
    cwb_analysis: {
      questionnaire_flags: cwbFlags,
      cwb_opt_out: cwbOptOut,
      earned_income_validated_cents: earnedIncomeValidated,
      earned_income_validated: fmt(earnedIncomeValidated),
      simulated_cwb_cents: simulatedCwb,
      simulated_cwb: fmt(simulatedCwb),
      diagnosis: cwbOptOut
        ? "⚠️ CWB désactivé par cwb_opt_out=true"
        : earnedIncomeValidated === 0
          ? "❌ Revenus d'emploi validés = 0$ → CWB = 0$"
          : simulatedCwb > 0
            ? `✅ CWB calculé = ${fmt(simulatedCwb)}`
            : `⚠️ CWB = 0$ (revenu ${fmt(earnedIncomeValidated)} — peut-être trop élevé)`,
    },

    // ── SECTION 5 : Dernier calcul en DB
    last_calculation: calc ? {
      calculatedAt: calc.calculatedAt,
      calculationVersion: calc.calculationVersion,
      // Lignes clés stockées
      federalTaxWithheldCents: calc.federalTaxWithheldCents,
      federalTaxWithheld: fmt(calc.federalTaxWithheldCents),
      federalRefundableCreditsCents: calc.federalRefundableCreditsCents,
      federalRefundableCredits: fmt(calc.federalRefundableCreditsCents),
      federalTaxPayableCents: calc.federalTaxPayableCents,
      federalBalanceCents: calc.federalBalanceCents,
      totalBalanceCents: calc.totalBalanceCents,
      // Settlement depuis calculationDetails
      settlement_stored: settlement,
      settlement_lines: {
        line43500: fmt(settlement.line43500 as number ?? calc.federalTaxPayableCents ?? 0),
        line43700: fmt(settlement.line43700 as number ?? calc.federalTaxWithheldCents ?? 0),
        line45300: fmt(settlement.line45300 as number ?? 0),
        line48200: fmt(settlement.line48200 as number ?? 0),
        line48400: fmt(settlement.line48400 as number ?? 0),
        line48500: fmt(settlement.line48500 as number ?? 0),
        status: settlement.status ?? "non défini",
      },
      has_settlement_in_details: Object.keys(settlement).length > 0,
      calc_details_keys: Object.keys(calcDetails),
      diagnosis: Object.keys(settlement).length === 0
        ? "❌ calculationDetails.settlement VIDE — calcul fait avec ancienne version du moteur, recalculer"
        : calc.federalTaxWithheldCents === 0
          ? "⚠️ federalTaxWithheldCents=0 en DB — retenue non transmise au moteur lors du calcul"
          : "✅ Calcul OK",
    } : {
      diagnosis: "❌ AUCUN CALCUL en DB pour ce dossier — cliquer 'Recalculer' dans l'app",
    },

    // ── SECTION 6 : Bug dans declaration/route.ts
    declaration_route_bug: {
      line_48200_current_formula:
        "addT1('48200', nonRefundableCredits + refundableCredits, 'calculated') ← FAUX",
      line_48200_correct_formula:
        "addT1('48200', federalTaxWithheldCents + federalRefundableCreditsCents, 'calculated') ← CORRECT",
      addT1_double_count_risk:
        "addT1 accumule (+=) — 43700 peut être compté 2× si présent dans deductions ET dans calc",
      status: "❌ Bug présent dans declaration/route.ts — correction nécessaire",
    },

    // ── RÉSUMÉ
    summary: {
      root_cause: federalWithheldEntries.length === 0
        ? "T4 box 22 jamais extrait en DB"
        : federalWithheldValidatedEntries.length === 0
          ? "T4 box 22 présent mais non validé (isValidated=false)"
          : !calc
            ? "Jamais recalculé après upload T4"
            : Object.keys(settlement).length === 0
              ? "Calcul fait avec ancienne version — recalculer pour avoir settlement"
              : calc.federalTaxWithheldCents === 0
                ? "federalTaxWithheldCents=0 stocké en DB malgré retenue détectée"
                : "Données OK — bug dans declaration/route.ts (formule 48200)",
      action_needed: [
        federalWithheldEntries.length === 0 ? "🔴 Reprocesser le T4 (OCR + validation)" : null,
        !calc ? "🔴 Cliquer Recalculer dans l'app" : null,
        Object.keys(settlement).length === 0 && calc ? "🟡 Recalculer pour générer settlement" : null,
        "🟡 Fix declaration/route.ts formule ligne 48200",
      ].filter(Boolean),
    },
  });
}
