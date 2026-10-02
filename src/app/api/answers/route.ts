import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, taxQuestions, taxQuestionAnswers, questionnaireSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// POST /api/answers — Sauvegarder une réponse (sauvegarde progressive)
export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { questionCode, answerValue, taxReturnId, taxYearId } = body;

  if (!questionCode || !taxReturnId || !taxYearId) {
    return NextResponse.json({ error: "questionCode, taxReturnId, taxYearId requis" }, { status: 400 });
  }

  const profile = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile[0]) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Trouver la question par code
  const question = await db.select({ id: taxQuestions.id, version: taxQuestions.version })
    .from(taxQuestions)
    .where(and(eq(taxQuestions.code, questionCode), eq(taxQuestions.isActive, true)))
    .limit(1);

  // Si la question n'existe pas en DB, on sauvegarde quand même via la session
  // (les questions peuvent être hard-codées côté frontend aussi)
  if (question[0]) {
    const existing = await db.select({ id: taxQuestionAnswers.id, answerValue: taxQuestionAnswers.answerValue })
      .from(taxQuestionAnswers)
      .where(and(
        eq(taxQuestionAnswers.userId, clerkUserId),
        eq(taxQuestionAnswers.taxReturnId, taxReturnId),
        eq(taxQuestionAnswers.questionId, question[0].id),
      )).limit(1);

    if (existing[0]) {
      await db.update(taxQuestionAnswers)
        .set({ previousValue: existing[0].answerValue, answerValue: String(answerValue), updatedAt: new Date() })
        .where(eq(taxQuestionAnswers.id, existing[0].id));
    } else {
      await db.insert(taxQuestionAnswers).values({
        userId: clerkUserId,
        taxProfileId: profile[0].id,
        taxYearId,
        taxReturnId,
        questionId: question[0].id,
        questionVersion: question[0].version,
        answerValue: String(answerValue),
      });
    }
  }

  // Mettre à jour le contexte de la session questionnaire
  const val = answerValue === true || answerValue === "true" || answerValue === "oui";

  const existingSession = await db.select({ id: questionnaireSessions.id, questionsAnswered: questionnaireSessions.questionsAnswered })
    .from(questionnaireSessions).where(eq(questionnaireSessions.taxReturnId, taxReturnId)).limit(1);

  const sessionUpdates: {
    lastQuestionCode: string;
    status: "in_progress";
    updatedAt: Date;
    hasEmploymentIncome?: boolean;
    hasSelfEmployment?: boolean;
    hasInvestmentIncome?: boolean;
    hasRentalIncome?: boolean;
    hasForeignIncome?: boolean;
    hasRrsp?: boolean;
    hasChildcare?: boolean;
    questionsAnswered?: number;
  } = {
    lastQuestionCode: questionCode,
    status: "in_progress" as const,
    updatedAt: new Date(),
  };

  if (questionCode === "has_employment_income") sessionUpdates.hasEmploymentIncome = val;
  if (questionCode === "has_self_employment") sessionUpdates.hasSelfEmployment = val;
  if (questionCode === "has_investment_income") sessionUpdates.hasInvestmentIncome = val;
  if (questionCode === "has_rental_income") sessionUpdates.hasRentalIncome = val;
  if (questionCode === "has_foreign_income") sessionUpdates.hasForeignIncome = val;
  if (questionCode === "has_rrsp_contribution") sessionUpdates.hasRrsp = val;
  if (questionCode === "childcare_expenses") sessionUpdates.hasChildcare = val;

  if (existingSession[0]) {
    sessionUpdates.questionsAnswered = (existingSession[0].questionsAnswered ?? 0) + 1;
    await db.update(questionnaireSessions).set(sessionUpdates).where(eq(questionnaireSessions.id, existingSession[0].id));
  } else {
    await db.insert(questionnaireSessions).values({
      userId: clerkUserId,
      taxProfileId: profile[0].id,
      taxReturnId,
      taxYearId,
      ...sessionUpdates,
      questionsAnswered: 1,
    });
  }

  return NextResponse.json({ saved: true, questionCode, answerValue });
}
