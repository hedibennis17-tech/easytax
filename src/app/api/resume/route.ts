import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, taxYears,
  incomeEntries, deductionEntries, creditEntries,
  taxCalculations, taxQuestionAnswers, taxQuestions,
  fiscalDocuments, documentExtractions, extractionFields,
  documentTypes,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

function fmt(cents: number | null | undefined): string {
  if (!cents) return "0,00 $";
  const abs = Math.abs(cents) / 100;
  return `${abs.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

export async function GET() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // 1. Profil
  const [profile] = await db.select().from(taxProfiles)
    .where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // 2. Dossier fiscal courant (année la plus récente)
  const [taxReturn] = await db.select({
    id: taxReturns.id,
    taxYearId: taxReturns.taxYearId,
    status: taxReturns.status,
    federalStatus: taxReturns.federalStatus,
    quebecStatus: taxReturns.quebecStatus,
    estimatedFederalRefund: taxReturns.estimatedFederalRefund,
    estimatedQuebecRefund: taxReturns.estimatedQuebecRefund,
    updatedAt: taxReturns.updatedAt,
  }).from(taxReturns)
    .where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt))
    .limit(1);

  const taxReturnId = taxReturn?.id ?? null;

  // 3. Année fiscale
  let taxYear = 2025;
  if (taxReturn?.taxYearId) {
    const [yr] = await db.select({ year: taxYears.year }).from(taxYears)
      .where(eq(taxYears.id, taxReturn.taxYearId)).limit(1);
    if (yr) taxYear = yr.year;
  }

  // 4. Revenus
  const incomes = taxReturnId
    ? await db.select().from(incomeEntries)
        .where(and(eq(incomeEntries.userId, clerkUserId), eq(incomeEntries.taxReturnId, taxReturnId)))
    : [];

  // 5. Déductions
  const deductions = taxReturnId
    ? await db.select().from(deductionEntries)
        .where(and(eq(deductionEntries.userId, clerkUserId), eq(deductionEntries.taxReturnId, taxReturnId)))
    : [];

  // 6. Crédits
  const credits = taxReturnId
    ? await db.select().from(creditEntries)
        .where(and(eq(creditEntries.userId, clerkUserId), eq(creditEntries.taxReturnId, taxReturnId)))
    : [];

  // 7. Dernier calcul fiscal
  const [calc] = taxReturnId
    ? await db.select().from(taxCalculations)
        .where(and(eq(taxCalculations.userId, clerkUserId), eq(taxCalculations.taxReturnId, taxReturnId)))
        .orderBy(desc(taxCalculations.calculatedAt)).limit(1)
    : [undefined];

  // 8. Feuillets + données extraites
  const docs = taxReturnId
    ? await db.select({
        id: fiscalDocuments.id,
        originalFilename: fiscalDocuments.originalFilename,
        status: fiscalDocuments.status,
        uploadedAt: fiscalDocuments.uploadedAt,
        typeName: documentTypes.labelFr,
        typeCode: documentTypes.code,
      }).from(fiscalDocuments)
        .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
        .where(and(eq(fiscalDocuments.userId, clerkUserId), eq(fiscalDocuments.taxReturnId, taxReturnId)))
    : [];

  // 9. Champs extraits des feuillets
  const slipData: Array<{
    documentId: string;
    filename: string;
    typeCode: string | null;
    typeName: string | null;
    fields: Array<{ code: string; label: string | null; value: string | null; validated: boolean; confidence: number | null }>;
  }> = [];

  for (const doc of docs) {
    const [extraction] = await db.select().from(documentExtractions)
      .where(eq(documentExtractions.fiscalDocumentId, doc.id))
      .orderBy(desc(documentExtractions.extractedAt)).limit(1);

    if (extraction) {
      const fields = await db.select().from(extractionFields)
        .where(eq(extractionFields.extractionId, extraction.id));

      slipData.push({
        documentId: doc.id,
        filename: doc.originalFilename,
        typeCode: doc.typeCode ?? null,
        typeName: doc.typeName ?? null,
        fields: fields.map(f => ({
          code: f.fieldCode,
          label: f.fieldLabel,
          value: f.validatedValue ?? f.rawOcrValue,
          validated: f.validationStatus === "confirmed" || f.validationStatus === "corrected",
          confidence: f.ocrConfidence,
        })),
      });
    }
  }

  // 10. Réponses questionnaire (résumé par catégorie)
  const questionAnswers = taxReturnId
    ? await db.select({
        questionCode: taxQuestions.code,
        questionLabel: taxQuestions.textFr,
        section: taxQuestions.section,
        answerValue: taxQuestionAnswers.answerValue,
        updatedAt: taxQuestionAnswers.updatedAt,
      }).from(taxQuestionAnswers)
        .innerJoin(taxQuestions, eq(taxQuestionAnswers.questionId, taxQuestions.id))
        .where(and(eq(taxQuestionAnswers.userId, clerkUserId), eq(taxQuestionAnswers.taxReturnId, taxReturnId)))
    : [];

  // 11. Calculs agrégés
  const totalIncomeCents = incomes.reduce((s, i) => s + (i.amountCents ?? 0), 0);
  const totalDeductionsCents = deductions.reduce((s, d) => s + (d.amountCents ?? 0), 0);
  const totalCreditsCents = credits.reduce((s, c) => s + (c.claimedAmountCents ?? 0), 0);
  const netIncomeCents = Math.max(0, totalIncomeCents - totalDeductionsCents);

  // 12. Province + labels
  const province = (profile.fiscalResidence ?? profile.province ?? "QC") as string;
  const PROVINCE_NAMES: Record<string, { fr: string; en: string; form: string }> = {
    QC: { fr: "Québec", en: "Quebec", form: "TP-1 + T1" },
    ON: { fr: "Ontario", en: "Ontario", form: "T1" },
    AB: { fr: "Alberta", en: "Alberta", form: "T1 + AT1" },
    BC: { fr: "Colombie-Britannique", en: "British Columbia", form: "T1" },
    SK: { fr: "Saskatchewan", en: "Saskatchewan", form: "T1" },
    MB: { fr: "Manitoba", en: "Manitoba", form: "T1" },
    NB: { fr: "Nouveau-Brunswick", en: "New Brunswick", form: "T1" },
    NS: { fr: "Nouvelle-Écosse", en: "Nova Scotia", form: "T1" },
    PE: { fr: "Île-du-Prince-Édouard", en: "Prince Edward Island", form: "T1" },
    NL: { fr: "Terre-Neuve-et-Labrador", en: "Newfoundland and Labrador", form: "T1" },
    NT: { fr: "Territoires du Nord-Ouest", en: "Northwest Territories", form: "T1" },
    NU: { fr: "Nunavut", en: "Nunavut", form: "T1" },
    YT: { fr: "Yukon", en: "Yukon", form: "T1" },
  };

  return NextResponse.json({
    meta: {
      taxYear,
      province,
      provinceNameFr: PROVINCE_NAMES[province]?.fr ?? province,
      provinceNameEn: PROVINCE_NAMES[province]?.en ?? province,
      declarationForm: PROVINCE_NAMES[province]?.form ?? "T1",
      profileName: `${profile.firstName} ${profile.lastName}`,
      sinLastFour: profile.sinLastFour ?? null,
      maritalStatus: profile.maritalStatus ?? "single",
      isPreliminary: true,
      taxReturnId,
      taxReturnStatus: taxReturn?.status ?? null,
      lastUpdated: taxReturn?.updatedAt ?? null,
    },
    // Revenus par catégorie
    incomes: incomes.map(i => ({
      id: i.id,
      category: i.category,
      amountCents: i.amountCents,
      amount: fmt(i.amountCents),
      description: i.description,
      employerName: i.employerName,
      sourceType: i.sourceType,
      isValidated: i.isValidated,
      sourceDocumentId: i.sourceDocumentId,
    })),
    // Déductions
    deductions: deductions.map(d => ({
      id: d.id,
      category: d.category,
      amountCents: d.amountCents,
      amount: fmt(d.amountCents),
      description: d.description,
      sourceType: d.sourceType,
      isValidated: d.isValidated,
    })),
    // Crédits
    credits: credits.map(c => ({
      id: c.id,
      category: c.category,
      amountCents: c.claimedAmountCents,
      amount: fmt(c.claimedAmountCents),
      description: c.description,
      sourceType: c.sourceType,
      isValidated: c.isValidated,
    })),
    // Feuillets + extraction OCR
    slips: slipData,
    // Documents uploadés (avec statut)
    documents: docs.map(d => ({
      id: d.id,
      filename: d.originalFilename,
      typeCode: d.typeCode,
      typeName: d.typeName,
      status: d.status,
      uploadedAt: d.uploadedAt,
      hasExtraction: slipData.some(s => s.documentId === d.id),
    })),
    // Réponses questionnaire (pour affichage éditable)
    questionAnswers: questionAnswers.map(q => ({
      code: q.questionCode,
      label: q.questionLabel,
      section: q.section,
      value: q.answerValue,
      updatedAt: q.updatedAt,
    })),
    // Totaux calculés
    totals: {
      incomeCents: totalIncomeCents,
      income: fmt(totalIncomeCents),
      deductionsCents: totalDeductionsCents,
      deductions: fmt(totalDeductionsCents),
      creditsCents: totalCreditsCents,
      credits: fmt(totalCreditsCents),
      netIncomeCents,
      netIncome: fmt(netIncomeCents),
      incomeCount: incomes.length,
      validatedIncomeCount: incomes.filter(i => i.isValidated).length,
      docCount: docs.length,
      docWithExtractionCount: slipData.length,
    },
    // Résultat moteur fiscal (si calculé)
    calculation: calc ? (() => {
      // Lire les lignes de règlement depuis calculationDetails
      let settlement: Record<string, number | string> = {};
      try {
        const details = typeof calc.calculationDetails === "string"
          ? JSON.parse(calc.calculationDetails)
          : calc.calculationDetails;
        if (details?.settlement) settlement = details.settlement as Record<string, number | string>;
      } catch { /* no-op */ }

      const line43500 = (settlement.line43500 as number) ?? (calc.federalTaxPayableCents ?? 0);
      const line43700 = (settlement.line43700 as number) ?? (calc.federalTaxWithheldCents ?? 0);
      const line45300 = (settlement.line45300 as number) ?? (calc.federalRefundableCreditsCents ?? 0);
      const line48200 = (settlement.line48200 as number) ?? (line43700 + line45300);
      const line48400 = (settlement.line48400 as number) ?? Math.max(0, line48200 - line43500);
      const line48500 = (settlement.line48500 as number) ?? Math.max(0, line43500 - line48200);
      const settlementStatus = (settlement.status as string) ?? (line48400 > 0 ? "REFUND" : line48500 > 0 ? "BALANCE_OWING" : "ZERO");

      return {
      calculatedAt: calc.calculatedAt,
      isPreliminary: calc.isPreliminary,
      rulesVersion: calc.rulesSnapshotVersion,
      totalIncomeCents: calc.totalIncomeCents,
      netIncomeCents: calc.netIncomeCents,
      taxableIncomeCents: calc.taxableIncomeCents,
      federal: {
        taxBeforeCreditsCents: calc.federalTaxBeforeCreditsCents,
        taxBeforeCredits: fmt(calc.federalTaxBeforeCreditsCents),
        creditsCents: calc.federalNonRefundableCreditsCents,
        credits: fmt(calc.federalNonRefundableCreditsCents),
        taxPayableCents: calc.federalTaxPayableCents,
        taxPayable: fmt(calc.federalTaxPayableCents),
        withheldCents: calc.federalTaxWithheldCents,
        withheld: fmt(calc.federalTaxWithheldCents),
        balanceCents: calc.federalBalanceCents,
        balance: fmt(calc.federalBalanceCents),
        isRefund: (calc.federalBalanceCents ?? 0) < 0,
        // Lignes T1 de règlement (avis de cotisation)
        line42000Cents: calc.federalTaxPayableCents ?? 0,
        line42000: fmt(calc.federalTaxPayableCents ?? 0),
        line43500Cents: line43500,
        line43500: fmt(line43500),
        line43700Cents: line43700,
        line43700: fmt(line43700),
        line45300Cents: line45300,
        line45300: fmt(line45300),
        line48200Cents: line48200,
        line48200: fmt(line48200),
        line48400Cents: line48400,
        line48400: fmt(line48400),
        line48500Cents: line48500,
        line48500: fmt(line48500),
        settlementStatus,
      },
      provincial: {
        taxBeforeCreditsCents: calc.provincialTaxBeforeCreditsCents,
        taxBeforeCredits: fmt(calc.provincialTaxBeforeCreditsCents),
        creditsCents: calc.provincialNonRefundableCreditsCents,
        credits: fmt(calc.provincialNonRefundableCreditsCents),
        taxPayableCents: calc.provincialTaxPayableCents,
        taxPayable: fmt(calc.provincialTaxPayableCents),
        withheldCents: calc.provincialTaxWithheldCents,
        withheld: fmt(calc.provincialTaxWithheldCents),
        balanceCents: calc.provincialBalanceCents,
        balance: fmt(calc.provincialBalanceCents),
        isRefund: (calc.provincialBalanceCents ?? 0) < 0,
      },
      totalBalanceCents: calc.totalBalanceCents,
      totalBalance: fmt(calc.totalBalanceCents),
      isRefund: (calc.totalBalanceCents ?? 0) < 0,
    };
    })() : null,
  });
}
