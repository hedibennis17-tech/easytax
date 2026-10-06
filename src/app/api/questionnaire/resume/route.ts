/**
 * GET /api/questionnaire/resume
 * Résumé complet de toutes les données collectées pendant le questionnaire
 * Sources: taxProfile + questionnaireSessions + incomeEntries + deductionEntries + creditEntries
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, questionnaireSessions,
  incomeEntries, deductionEntries, creditEntries, fiscalDocuments, documentTypes,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

function fmtCAD(cents: number) {
  return (cents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) + " $";
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select().from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [tr] = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId, status: taxReturns.status })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);

  // Session questionnaire
  const [session] = tr ? await db.select().from(questionnaireSessions)
    .where(and(eq(questionnaireSessions.userId, userId), eq(questionnaireSessions.taxReturnId, tr.id)))
    .limit(1) : [null];

  // Entrées financières
  const incomes    = tr ? await db.select().from(incomeEntries).where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, tr.id))) : [];
  const deductions = tr ? await db.select().from(deductionEntries).where(and(eq(deductionEntries.userId, userId), eq(deductionEntries.taxReturnId, tr.id))) : [];
  const credits    = tr ? await db.select().from(creditEntries).where(and(eq(creditEntries.userId, userId), eq(creditEntries.taxReturnId, tr.id))) : [];

  // Documents
  const docs = tr ? await db.select({
    id: fiscalDocuments.id, status: fiscalDocuments.status, typeCode: documentTypes.code,
  }).from(fiscalDocuments)
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(and(eq(fiscalDocuments.userId, userId), eq(fiscalDocuments.taxReturnId, tr.id))) : [];

  // Pancanadian data (réponses complètes du questionnaire)
  let qAnswers: Record<string, unknown> = {};
  if (profile.pancanadianData) {
    try {
      const pd = JSON.parse(profile.pancanadianData) as { questionnaireAnswers?: Record<string, unknown> };
      qAnswers = pd.questionnaireAnswers ?? {};
    } catch { /* ignore */ }
  }

  // Totaux
  const totalRevenueCents = incomes.reduce((s, i) => s + (i.amountCents ?? 0), 0);
  const totalDeductionsCents = deductions.reduce((s, d) => s + (d.amountCents ?? 0), 0);

  // Sections complétées
  let sectionsCompleted: string[] = [];
  if (session?.sectionsCompleted) {
    try { sectionsCompleted = JSON.parse(session.sectionsCompleted as string); } catch { /* ignore */ }
  }

  return NextResponse.json({
    // Profil
    profil: {
      nom: `${profile.firstName} ${profile.lastName}`,
      dateNaissance: profile.dateOfBirth,
      nas: profile.sinLastFour ? `···· ${profile.sinLastFour}` : null,
      adresse: [profile.address, profile.city, profile.province, profile.postalCode].filter(Boolean).join(", "),
      province: profile.fiscalResidence ?? profile.province,
      etatCivil: profile.maritalStatus,
      telephone: profile.phone,
      email: profile.email,
    },
    // Questionnaire
    questionnaire: {
      sessionId: session?.id ?? null,
      status: session?.status ?? "not_started",
      sectionsCompleted,
      questionsAnswered: session?.questionsAnswered ?? Object.keys(qAnswers).length,
      // Flags de situation
      situation: {
        emploi:      session?.hasEmploymentIncome ?? (qAnswers["t1"] === true),
        autonome:    session?.hasSelfEmployment ?? (qAnswers["t2"] === true),
        location:    session?.hasRentalIncome ?? (qAnswers["t3"] === true),
        placements:  session?.hasInvestmentIncome ?? (qAnswers["t4"] === true),
        reer:        session?.hasRrsp ?? false,
        garde:       session?.hasChildcare ?? false,
      },
      // Réponses questionnaire sauvegardées
      reponses: Object.entries(qAnswers).filter(([k]) =>
        // Exclure les clés internes
        !["triage_done","profil_done","revenus_validated","credits_validated","credits_selected","revenus_total_cents"].includes(k)
      ).map(([k, v]) => ({ question: k, reponse: v })),
    },
    // Revenus
    revenus: {
      total: fmtCAD(totalRevenueCents),
      totalCents: totalRevenueCents,
      entries: incomes.map(i => ({
        id: i.id,
        categorie: i.category,
        montant: fmtCAD(i.amountCents ?? 0),
        montantCents: i.amountCents,
        description: i.description,
        source: i.sourceType,
        valide: i.isValidated,
      })),
    },
    // Déductions
    deductions: {
      total: fmtCAD(totalDeductionsCents),
      totalCents: totalDeductionsCents,
      entries: deductions.map(d => ({
        id: d.id,
        categorie: d.category,
        montant: fmtCAD(d.amountCents ?? 0),
        description: d.description,
        valide: d.isValidated,
      })),
    },
    // Crédits sélectionnés
    credits: {
      count: credits.length,
      entries: credits.map(c => ({
        id: c.id,
        categorie: c.category,
        montant: c.claimedAmountCents ? fmtCAD(c.claimedAmountCents) : null,
        valide: c.isValidated,
      })),
      // Programmes sélectionnés dans le questionnaire
      programmesSelectionnes: Array.isArray(qAnswers["credits_selected"]) ? qAnswers["credits_selected"] : [],
    },
    // Documents uploadés
    documents: docs.map(d => ({
      id: d.id.slice(0, 8),
      type: d.typeCode ?? "OTHER",
      status: d.status,
    })),
    // Résumé financier
    resume: {
      revenuTotal: fmtCAD(totalRevenueCents),
      deductionsTotal: fmtCAD(totalDeductionsCents),
      revenuNet: fmtCAD(Math.max(0, totalRevenueCents - totalDeductionsCents)),
      docsValides: docs.filter(d => ["extracted", "needs_review"].includes(d.status ?? "")).length,
      docsTotal: docs.length,
      pret: sectionsCompleted.length >= 4, // triage + profil + revenus + au moins 1 autre
    },
  });
}
