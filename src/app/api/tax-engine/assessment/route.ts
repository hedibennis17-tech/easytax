import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseNoticeOfAssessment, reconcileAssessment, type AssessmentLineCode } from "@/lib/tax-engine/assessment";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json() as { text?: string; calculatedLines?: Partial<Record<AssessmentLineCode, number>>; save?: boolean };
  const text = String(body.text ?? "").trim();
  if (text.length < 80) return NextResponse.json({ error: "Le texte de l’avis est trop court." }, { status: 400 });

  const assessment = parseNoticeOfAssessment(text);
  if (!assessment.taxYear || Object.keys(assessment.lines).length === 0) {
    return NextResponse.json({ error: "Avis de cotisation non reconnu: année ou lignes fiscales absentes." }, { status: 422 });
  }
  const reconciliation = reconcileAssessment(assessment, body.calculatedLines ?? {});

  if (body.save) {
    const [profile] = await db.select({ pancanadianData: taxProfiles.pancanadianData })
      .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
    if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    let existing: Record<string, unknown> = {};
    try { existing = JSON.parse(profile.pancanadianData ?? "{}"); } catch { /* legacy value */ }
    await db.update(taxProfiles).set({
      pancanadianData: JSON.stringify({ ...existing, noticeOfAssessment: assessment }),
      updatedAt: new Date(),
    }).where(eq(taxProfiles.userId, userId));
  }

  return NextResponse.json({ assessment, reconciliation, saved: Boolean(body.save) });
}
