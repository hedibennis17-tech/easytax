import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

function parseData(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
}

async function saveAnswer(req: NextRequest, remove: boolean) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json() as { questionId?: string; value?: unknown; validated?: boolean };
  const questionId = String(body.questionId ?? "").trim();
  if (!questionId) return NextResponse.json({ error: "questionId requis" }, { status: 400 });

  const [profile] = await db.select({ id: taxProfiles.id, pancanadianData: taxProfiles.pancanadianData })
    .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const data = parseData(profile.pancanadianData);
  const answers = { ...((data.questionnaireAnswers ?? {}) as Record<string, unknown>) };
  const validated = { ...((data.questionnaireValidated ?? {}) as Record<string, boolean>) };
  const oldValue = answers[questionId];
  if (remove) {
    delete answers[questionId];
    delete validated[questionId];
  } else {
    answers[questionId] = body.value;
    if (body.validated !== undefined) validated[questionId] = Boolean(body.validated);
  }

  await db.update(taxProfiles).set({
    pancanadianData: JSON.stringify({ ...data, questionnaireAnswers: answers, questionnaireValidated: validated }),
    updatedAt: new Date(),
  }).where(eq(taxProfiles.userId, userId));

  // Audit dans la nouvelle base questionnaire si la migration est déjà active.
  try {
    const sessions = await db.execute(sql`SELECT id FROM q_sessions WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 1`) as unknown as Array<{ id: string }>;
    if (sessions[0]) {
      await db.execute(sql`
        INSERT INTO q_answer_history (session_id, table_name, question_id, old_value, new_value, changed_by)
        VALUES (${sessions[0].id}, 'pancanadianData', ${questionId}, ${oldValue === undefined ? null : JSON.stringify(oldValue)}, ${remove ? null : JSON.stringify(body.value)}, ${userId})
      `);
    }
  } catch {
    // Le résumé reste fonctionnel avant l’application de la migration SQL.
  }

  return NextResponse.json({ ok: true, questionId, removed: remove, validated: Boolean(validated[questionId]) });
}

export async function PATCH(req: NextRequest) { return saveAnswer(req, false); }
export async function DELETE(req: NextRequest) { return saveAnswer(req, true); }
