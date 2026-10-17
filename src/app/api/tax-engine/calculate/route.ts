import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxReturns, taxProfiles, taxYears,
  incomeEntries, deductionEntries, creditEntries, taxCalculations,
  fiscalDocuments, documentExtractions, documentPages, documentTypes,
} from "@/db/schema";
import { eq, and, inArray, isNull, desc } from "drizzle-orm";
import { calculate } from "@/lib/tax-engine/engine";
import type { TaxEngineInput } from "@/lib/tax-engine/types";
import { classifySlip } from "@/lib/ocr/dictionnaire";
import { syncOcrToEntries } from "@/lib/ocr-to-entries";

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { taxReturnId } = body;
  const rebuild = body.rebuild === true;
  if (!taxReturnId) return NextResponse.json({ error: "taxReturnId requis" }, { status: 400 });

  const profile = await db.select({ id: taxProfiles.id, province: taxProfiles.province, fiscalResidence: taxProfiles.fiscalResidence, pancanadianData: taxProfiles.pancanadianData })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile[0]) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const taxReturn = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId })
    .from(taxReturns)
    .where(and(eq(taxReturns.id, taxReturnId), eq(taxReturns.profileId, profile[0].id)))
    .limit(1);
  if (!taxReturn[0]) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

  // Recalcul complet : repartir uniquement des documents actuels. Les entrées
  // manuelles restent intactes; seules les entrées produites par un document
  // encore présent sont supprimées puis reconstruites depuis l'OCR enregistré.
  // Cela évite les doublons historiques et garantit qu'un document supprimé ne
  // peut plus alimenter la déclaration.
  let rebuiltDocuments = 0;
  let rebuiltEntries = 0;
  if (rebuild) {
    const currentDocuments = await db.select({
      id: fiscalDocuments.id,
      typeCode: documentTypes.code,
    })
      .from(fiscalDocuments)
      .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
      .where(and(
        eq(fiscalDocuments.userId, clerkUserId),
        eq(fiscalDocuments.taxReturnId, taxReturnId),
        isNull(fiscalDocuments.deletedAt),
      ));
    const documentIds = currentDocuments.map((document) => document.id);

    if (documentIds.length > 0) {
      await Promise.all([
        db.delete(incomeEntries).where(and(eq(incomeEntries.userId, clerkUserId), inArray(incomeEntries.sourceDocumentId, documentIds))),
        db.delete(deductionEntries).where(and(eq(deductionEntries.userId, clerkUserId), inArray(deductionEntries.sourceDocumentId, documentIds))),
        db.delete(creditEntries).where(and(eq(creditEntries.userId, clerkUserId), inArray(creditEntries.sourceDocumentId, documentIds))),
      ]);
    }
    await db.delete(taxCalculations).where(and(eq(taxCalculations.userId, clerkUserId), eq(taxCalculations.taxReturnId, taxReturnId)));

    for (const document of currentDocuments) {
      const [extraction] = await db.select({ id: documentExtractions.id })
        .from(documentExtractions)
        .where(eq(documentExtractions.fiscalDocumentId, document.id))
        .orderBy(desc(documentExtractions.updatedAt))
        .limit(1);
      if (!extraction) continue;
      const pages = await db.select({ text: documentPages.ocrText })
        .from(documentPages)
        .where(eq(documentPages.documentId, document.id))
        .orderBy(documentPages.pageNumber);
      const ocrText = pages.map((page) => page.text ?? "").filter(Boolean).join("\n\n");
      const detectedType = ocrText ? classifySlip(ocrText) : null;
      const rawType = detectedType ?? document.typeCode ?? "T4";
      const documentTypeCode = rawType.match(/^RL(\d+)$/i)?.[1]
        ? `RL-${rawType.match(/^RL(\d+)$/i)?.[1]}`
        : rawType;
      const sync = await syncOcrToEntries({
        extractionId: extraction.id,
        documentId: document.id,
        userId: clerkUserId,
        taxReturnId,
        documentTypeCode,
        ocrText: ocrText || undefined,
        replaceExisting: true,
      });
      rebuiltDocuments++;
      rebuiltEntries += sync.created;
    }
  }

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
  // Regex unifié — couvre toutes les descriptions possibles pour la retenue fédérale T4 case 22
  const FEDERAL_WITHHELD_RE = /impôt sur le revenu retenu|impôt fédéral|federal income tax withheld|income tax deducted/i;
  const PROVINCIAL_WITHHELD_RE = /impôt du québec|impôt provincial|provincial income tax withheld|provincial tax withheld/i;

  const federalWithheldFromSlips = deductions
    .filter(d => FEDERAL_WITHHELD_RE.test(d.description ?? ""))
    .reduce((sum, d) => sum + (d.amountCents ?? 0), 0);
  const provincialWithheldFromSlips = deductions
    .filter(d => PROVINCIAL_WITHHELD_RE.test(d.description ?? ""))
    .reduce((sum, d) => sum + (d.amountCents ?? 0), 0);
  // Les cotisations salariales RRQ/RPC, RQAP/AE sont des crédits/éléments de
  // paie. Elles ne doivent jamais réduire directement la ligne 23600.
  const PAYROLL_CREDIT_RE = /(?:cotisations?|contributions?).*(?:rrq|rpc|qpp|cpp|rqap|qpip|ae|assurance[- ]emploi)|(?:rrq|rpc|qpp|cpp)\s*\/\s*(?:rrq|rpc|qpp|cpp)|(?:t4|rl[- ]?1).*(?:case|box|caisse)\s*(?:16|18|b|c)\b|(?:case|box)\s*(?:16|18|b|c)\b.*(?:t4|rl[- ]?1)/i;
  const payrollCredits = deductions.filter(d => PAYROLL_CREDIT_RE.test(d.description ?? ""));
  const NET_INCOME_DEDUCTION_CATEGORIES = new Set([
    "rrsp", "union_dues", "childcare", "moving_expenses",
    "employment_expenses", "carrying_charges",
  ]);
  const taxableDeductions = deductions.filter(d =>
    !FEDERAL_WITHHELD_RE.test(d.description ?? "") &&
    !PROVINCIAL_WITHHELD_RE.test(d.description ?? "") &&
    !PAYROLL_CREDIT_RE.test(d.description ?? "") &&
    NET_INCOME_DEDUCTION_CATEGORIES.has(d.category ?? "")
  );
  const answers = (pancanadian.answers ?? pancanadian.questionnaireAnswers ?? pancanadian) as Record<string, unknown>;
  const earnedIncomeCents = incomes.filter(i => i.category === "employment" || i.category === "self_employment").reduce((sum, i) => sum + (i.amountCents ?? 0), 0);
  const dependentCount = Array.isArray(answers.dependents)
    ? answers.dependents.length
    : Number(answers.dependentCount ?? answers.numberOfDependents ?? 0) || 0;
  const cwbConfirmed = [answers.c17, answers.act_cwb, answers.cwb].some(value =>
    value === true || value === "true" || value === "oui" || value === "yes"
  );

  // ACT/CWB 2025 — calculé automatiquement pour tout résident avec revenu d'emploi éligible.
  // Le questionnaire peut désactiver via answers.cwb_opt_out === true.
  // Source officielle : ARC 5005-S6 (2025), Revenu Québec.
  // INTERDIT : hardcoder les montants du test de régression.
  const cwbOptOut = [answers.cwb_opt_out].some(value => value === true || value === "true");
  // cwbConfirmed = questionnaire c17=oui. Si non répondu (undefined/null), on calcule quand même
  // car l'ARC calcule l'ACT automatiquement pour les résidents admissibles.
  // L'opt-out explicite (cwb_opt_out=true) est la seule façon de désactiver.
  const cwbEligible = !cwbOptOut && earnedIncomeCents > 0;
  let cwbCents = 0;
  if (cwbEligible) {
    if (province === "QC") {
      // ─── 5005-S6 Québec 2025 (ARC Schedule 6 — résidents QC) ───────────────
      // Source officielle : Annexe 6 pour les résidents du Québec, 2025
      // https://www.canada.ca/en/revenue-agency/services/forms-publications/forms/5005-s6.html
      //
      // Situation familiale au 31 décembre 2025 :
      //   A) Célibataire sans personne à charge admissible
      //      phase-in : 37,3 % × max(revenu travail − 2 400 $, 0)
      //      max ACT de base : 3 812,06 $
      //      réduction : 20 % × max(revenu net ajusté − 14 170,05 $, 0)
      //      revenu max (ACT = 0) : 33 230,35 $
      //
      //   B) Célibataire avec personne à charge admissible
      //      phase-in : 20 % × max(revenu travail − 2 400 $, 0)
      //      max ACT de base : 2 044,00 $
      //      réduction : 20 % × max(revenu net ajusté − 14 170,05 $, 0)
      //      revenu max (ACT = 0) : 24 390,05 $
      //
      //   C) Couple sans personne à charge admissible
      //      phase-in : 37,3 % × max(revenu travail conjoint − 3 600 $, 0) [revenu le plus élevé]
      //      max ACT de base : 5 943,38 $
      //      réduction : 20 % × max(revenu net familial ajusté − 29 645,00 $, 0)
      //      revenu max (ACT = 0) : 59 361,90 $
      //
      //   D) Couple avec personne à charge admissible
      //      phase-in : 23,9 % × max(revenu travail − 3 600 $, 0)
      //      max ACT de base : 3 808,23 $
      //      réduction : 20 % × max(revenu net familial ajusté − 29 645,00 $, 0)
      //      revenu max (ACT = 0) : 48 686,15 $
      //
      // RÈGLES :
      //   - Revenu de travail admissible = salaires + travail autonome (pas ligne 15000 globale)
      //   - Revenu net ajusté = ligne 23600 (simplifié ici : netIncome du moteur)
      //   - Supplément d'invalidité (jusqu'à 851,31 $) non inclus ici — nécessite CIPH
      //   - Avances RC210 (ligne 41500) non déduites ici (traitées séparément)

      const isCouple = answers.maritalStatus === "married" || answers.maritalStatus === "common_law"
        || answers.maritalStatus === "marie" || answers.maritalStatus === "union_de_fait"
        || answers.hasSpouse === true || answers.hasSpouse === "true";
      const hasDependent = dependentCount > 0;

      // Seuil revenu de travail minimal (cents)
      const phaseInThresholdCents = isCouple ? 360000 : 240000; // 3 600 $ couple / 2 400 $ solo

      // Paramètres selon situation familiale (en cents)
      let phaseInRateNumerator: number;   // numérateur pour éviter les floats
      let phaseInRateDenominator: number;
      let maxBasicBenefitCents: number;
      let reductionThresholdCents: number;
      const reductionRateNumerator = 20;   // 20 %
      const reductionRateDenominator = 100;

      if (!isCouple && !hasDependent) {
        // Cas A : célibataire sans personne à charge
        phaseInRateNumerator = 373; phaseInRateDenominator = 1000; // 37,3 %
        maxBasicBenefitCents = 381206; // 3 812,06 $
        reductionThresholdCents = 1417005; // 14 170,05 $
      } else if (!isCouple && hasDependent) {
        // Cas B : célibataire avec personne à charge
        phaseInRateNumerator = 20; phaseInRateDenominator = 100; // 20 %
        maxBasicBenefitCents = 204400; // 2 044,00 $
        reductionThresholdCents = 1417005; // 14 170,05 $
      } else if (isCouple && !hasDependent) {
        // Cas C : couple sans personne à charge
        phaseInRateNumerator = 373; phaseInRateDenominator = 1000; // 37,3 %
        maxBasicBenefitCents = 594338; // 5 943,38 $
        reductionThresholdCents = 2964500; // 29 645,00 $
      } else {
        // Cas D : couple avec personne à charge
        phaseInRateNumerator = 239; phaseInRateDenominator = 1000; // 23,9 %
        maxBasicBenefitCents = 380823; // 3 808,23 $
        reductionThresholdCents = 2964500; // 29 645,00 $
      }

      // Phase-in : min(max(revenuTravail − seuil, 0) × taux, maxBénéfice)
      const excessIncomeCents = Math.max(0, earnedIncomeCents - phaseInThresholdCents);
      const phaseInCents = Math.min(
        maxBasicBenefitCents,
        Math.floor(excessIncomeCents * phaseInRateNumerator / phaseInRateDenominator)
      );

      // Réduction : max(revenuNetAjusté − seuil, 0) × 20 %
      // On utilise earnedIncomeCents comme approximation du revenu net ajusté
      // (la couche appelante peut affiner avec netIncomeCents si disponible)
      const adjustedNetIncomeCents = earnedIncomeCents; // conservateur — même source que phase-in
      const reductionCents = Math.floor(
        Math.max(0, adjustedNetIncomeCents - reductionThresholdCents)
          * reductionRateNumerator / reductionRateDenominator
      );

      cwbCents = Math.max(0, phaseInCents - reductionCents);
    } else {
      // ─── Formule fédérale générique (hors QC) — Schedule 6 fédéral 2025 ──
      // Source : ARC T1-2025, Schedule 6 (résidents hors QC)
      // Célibataire sans personne : phase-in 26,7% au-delà de 3 000 $, max 1 590 $
      //   réduction 12% au-delà de 26 149 $
      // Couple / personne à charge : paramètres distincts ci-dessous
      const isCouple = dependentCount > 0 || answers.maritalStatus === "married" || answers.maritalStatus === "common_law";
      const hasDependent = dependentCount > 0;

      let phaseInRateNum: number, phaseInRateDen: number;
      let maxBenefitCents: number;
      let reductionThresholdCents: number;
      const reductionRateNum = 12, reductionRateDen = 100; // 12 % hors QC

      if (!isCouple && !hasDependent) {
        phaseInRateNum = 267; phaseInRateDen = 1000; // 26,7 %
        maxBenefitCents = 159000;       // 1 590 $
        reductionThresholdCents = 2614900; // 26 149 $
      } else if (!isCouple && hasDependent) {
        phaseInRateNum = 267; phaseInRateDen = 1000; // 26,7 %
        maxBenefitCents = 275600;       // 2 756 $
        reductionThresholdCents = 2614900; // 26 149 $
      } else if (isCouple && !hasDependent) {
        phaseInRateNum = 267; phaseInRateDen = 1000; // 26,7 %
        maxBenefitCents = 275600;       // 2 756 $
        reductionThresholdCents = 3222700; // 32 227 $
      } else {
        phaseInRateNum = 267; phaseInRateDen = 1000; // 26,7 %
        maxBenefitCents = 275600;       // 2 756 $
        reductionThresholdCents = 3222700; // 32 227 $
      }

      const excessNonQC = Math.max(0, earnedIncomeCents - 300000); // seuil 3 000 $
      const phaseInNonQC = Math.min(maxBenefitCents, Math.floor(excessNonQC * phaseInRateNum / phaseInRateDen));
      const reductionNonQC = Math.floor(Math.max(0, earnedIncomeCents - reductionThresholdCents) * reductionRateNum / reductionRateDen);
      cwbCents = Math.max(0, phaseInNonQC - reductionNonQC);
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
      ...payrollCredits.map((d) => ({
        category: "other_credits" as const,
        claimedAmountCents: d.amountCents ?? 0,
        sourceType: (d.sourceType as "validated_ocr" | "manual"),
        description: d.description ?? "Cotisation salariale",
        isRefundable: false,
        jurisdiction: "CA" as const,
      })),
      ...credits.map((c) => ({
      category: c.category,
      claimedAmountCents: c.claimedAmountCents ?? 0,
      sourceType: (c.sourceType as "validated_ocr" | "manual"),
      description: c.description ?? undefined,
      isRefundable: /remboursable|prestation|allocation|benefit|act_cwb|acfb/i.test(`${c.category} ${c.description ?? ""}`),
      })),
      ...(cwbCents > 0 ? [{ category: "other_credits" as const, claimedAmountCents: cwbCents, sourceType: "manual" as const, description: "Allocation canadienne pour les travailleurs (ACT/CWB) — ligne 45300", isRefundable: true, jurisdiction: "CA" as const, line: "45300" }] : []),
    ],
    taxWithheldFederalCents: (body.taxWithheldFederalCents ?? 0) + federalWithheldFromSlips,
    taxWithheldProvincialCents: (body.taxWithheldProvincialCents ?? 0) + provincialWithheldFromSlips,
    hasSpouse: body.hasSpouse ?? false,
    dependentCount,
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
      rebuild: rebuild ? { documents: rebuiltDocuments, entries: rebuiltEntries } : undefined,
      warning: "RÉSULTATS PRÉLIMINAIRES — Aucune déclaration transmise.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur de calcul";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
