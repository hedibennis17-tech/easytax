import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  taxQuestions,
  taxQuestionOptions,
  taxQuestionRules,
  taxQuestionAnswers,
  taxProfiles,
} from "@/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// GET /api/questions?taxYearId=xxx&section=employment&jurisdictionId=xxx
// Retourne les questions actives avec leurs options et règles de visibilité
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") as "identity" | "family" | "employment" | "self_employment" | "investment" | "deductions" | "credits" | "provincial" | "review" | null;
  const taxYearId = searchParams.get("taxYearId");
  const jurisdictionId = searchParams.get("jurisdictionId");

  // Questions globales (jurisdictionId null) + questions de la juridiction demandée
  const conditions = [eq(taxQuestions.isActive, true)];
  if (section) conditions.push(eq(taxQuestions.section, section));

  const questions = await db
    .select({
      id: taxQuestions.id,
      code: taxQuestions.code,
      version: taxQuestions.version,
      section: taxQuestions.section,
      questionType: taxQuestions.questionType,
      textFr: taxQuestions.textFr,
      textEn: taxQuestions.textEn,
      hintFr: taxQuestions.hintFr,
      hintEn: taxQuestions.hintEn,
      required: taxQuestions.required,
      displayOrder: taxQuestions.displayOrder,
      jurisdictionId: taxQuestions.jurisdictionId,
      taxYearId: taxQuestions.taxYearId,
    })
    .from(taxQuestions)
    .where(and(...conditions))
    .orderBy(taxQuestions.displayOrder);

  // Filtrer par juridiction (null = toutes) et année (null = toutes)
  const filtered = questions.filter((q) => {
    if (q.jurisdictionId && jurisdictionId && q.jurisdictionId !== jurisdictionId) return false;
    if (q.taxYearId && taxYearId && q.taxYearId !== taxYearId) return false;
    return true;
  });

  // Charger les options et règles pour chaque question
  const questionsWithDetails = await Promise.all(
    filtered.map(async (q) => {
      const options = await db
        .select()
        .from(taxQuestionOptions)
        .where(and(eq(taxQuestionOptions.questionId, q.id), eq(taxQuestionOptions.isActive, true)))
        .orderBy(taxQuestionOptions.displayOrder);

      const rules = await db
        .select()
        .from(taxQuestionRules)
        .where(and(eq(taxQuestionRules.questionId, q.id), eq(taxQuestionRules.isActive, true)));

      return { ...q, options, rules };
    })
  );

  return NextResponse.json({ questions: questionsWithDetails });
}

// POST /api/questions/answers — Sauvegarder une réponse
// (placé ici pour simplicité — peut être déplacé dans /api/questions/answers)
