/**
 * POST /api/questionnaire/save
 * Sauvegarde toutes les réponses du questionnaire en DB
 * Appelé automatiquement à chaque section complétée
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, taxYears,
  questionnaireSessions, incomeEntries, deductionEntries,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { normalizeProvinceCode } from "@/lib/provinces";
import type { QuestionnaireProgress } from "@/lib/questionnaire-progress";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json() as {
    answers: Record<string, unknown>;
    sectionCompleted?: string;
    currentSection?: string;
    questionsAnswered?: number;
    progress?: QuestionnaireProgress;
  };

  const { answers, sectionCompleted, currentSection, questionsAnswered, progress } = body;

  // Récupérer profil + taxReturn
  const [profile] = await db.select({
    id: taxProfiles.id,
    pancanadianData: taxProfiles.pancanadianData,
    fiscalResidence: taxProfiles.fiscalResidence,
    province: taxProfiles.province,
  })
    .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [tr] = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);
  if (!tr) return NextResponse.json({ error: "TaxReturn introuvable" }, { status: 404 });

  // Inférer les flags depuis les réponses
  const hasEmployment   = answers["t1"] === true || answers["t1"] === "true";
  const hasSelfEmp      = answers["t2"] === true || answers["t2"] === "true";
  const hasRental       = answers["t3"] === true || answers["t3"] === "true";
  const hasInvestment   = answers["t4"] === true || answers["t4"] === "true";
  const hasRrsp         = !!(answers["r_reer"] || answers["deductions_reer"]);
  const hasChildcare    = answers["f4"] === true || answers["f4"] === "true";
  // Ne jamais réinitialiser la province à QC pendant un autosave : une réponse
  // de triage peut arriver avant le champ d’adresse. La province du wizard reste
  // donc la source principale tant que le questionnaire ne fournit pas une valeur valide.
  const province = normalizeProvinceCode(progress?.province)
    ?? normalizeProvinceCode(answers["t0"])
    ?? normalizeProvinceCode(answers["province"])
    ?? normalizeProvinceCode(answers["p14"])
    ?? normalizeProvinceCode(profile.fiscalResidence)
    ?? normalizeProvinceCode(profile.province);

  // Sections complétées
  const sectionsCompleted: string[] = progress?.sections
    .filter(section => section.completed)
    .map(section => section.code) ?? [];
  if (answers["triage_done"])    sectionsCompleted.push("triage");
  if (answers["profil_done"])    sectionsCompleted.push("profil");
  if (answers["revenus_validated"]) sectionsCompleted.push("revenus");
  if (answers["credits_validated"]) sectionsCompleted.push("credits");
  if (sectionCompleted && !sectionsCompleted.includes(sectionCompleted)) {
    sectionsCompleted.push(sectionCompleted);
  }

  // Upsert questionnaire_sessions
  const [existing] = await db.select({ id: questionnaireSessions.id })
    .from(questionnaireSessions)
    .where(and(
      eq(questionnaireSessions.userId, userId),
      eq(questionnaireSessions.taxReturnId, tr.id),
    )).limit(1);

  const sessionData = {
    userId,
    taxProfileId: profile.id,
    taxReturnId: tr.id,
    taxYearId: tr.taxYearId,
    status: "in_progress" as const,
    currentSection: progress?.currentSection ?? currentSection ?? sectionCompleted ?? null,
    sectionsCompleted: JSON.stringify(sectionsCompleted),
    hasEmploymentIncome: hasEmployment,
    hasSelfEmployment:   hasSelfEmp,
    hasInvestmentIncome: hasInvestment,
    hasRentalIncome:     hasRental,
    hasForeignIncome:    !!(answers["r_pla_etranger"]),
    hasRrsp:             hasRrsp,
    hasChildcare:        hasChildcare,
    questionsAnswered:   progress?.questionsAnswered ?? questionsAnswered ?? Object.keys(answers).length,
    updatedAt: new Date(),
  };

  let sessionId: string;
  if (existing) {
    await db.update(questionnaireSessions).set(sessionData).where(eq(questionnaireSessions.id, existing.id));
    sessionId = existing.id;
  } else {
    const [created] = await db.insert(questionnaireSessions).values({ ...sessionData, createdAt: new Date() })
      .returning({ id: questionnaireSessions.id });
    sessionId = created.id;
  }

  // Sauvegarder les questions complémentaires revenus → incomeEntries / deductionEntries
  let entriesCreated = 0;

  // Pourboires non déclarés (r_emp_tip)
  if (answers["r_emp_tip"] && typeof answers["r_emp_tip"] === "string") {
    const cents = Math.round(parseFloat(String(answers["r_emp_tip"]).replace(",", ".")) * 100);
    if (cents > 0) {
      const exists = await db.select({ id: incomeEntries.id }).from(incomeEntries)
        .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, tr.id), eq(incomeEntries.category, "other_income")))
        .limit(1);
      if (!exists[0]) {
        await db.insert(incomeEntries).values({
          userId, taxProfileId: profile.id, taxYearId: tr.taxYearId, taxReturnId: tr.id,
          category: "other_income", amountCents: cents,
          description: "Pourboires non déclarés (questionnaire)", isValidated: false, updatedAt: new Date(),
        });
        entriesCreated++;
      }
    }
  }

  // Revenus autonome bruts (r_aut_brut)
  if (answers["r_aut_brut"] && typeof answers["r_aut_brut"] === "string") {
    const cents = Math.round(parseFloat(String(answers["r_aut_brut"]).replace(",", ".")) * 100);
    if (cents > 0) {
      const exists = await db.select({ id: incomeEntries.id }).from(incomeEntries)
        .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, tr.id), eq(incomeEntries.category, "self_employment")))
        .limit(1);
      if (!exists[0]) {
        await db.insert(incomeEntries).values({
          userId, taxProfileId: profile.id, taxYearId: tr.taxYearId, taxReturnId: tr.id,
          category: "self_employment", amountCents: cents,
          description: `Revenus autonome${answers["r_aut_type"] ? ` (${answers["r_aut_type"]})` : ""} (questionnaire)`,
          isValidated: false, updatedAt: new Date(),
        });
        entriesCreated++;
      }
    }
  }

  // Location (r_loc_brut)
  if (answers["r_loc_brut"] && typeof answers["r_loc_brut"] === "string") {
    const cents = Math.round(parseFloat(String(answers["r_loc_brut"]).replace(",", ".")) * 100);
    if (cents > 0) {
      const exists = await db.select({ id: incomeEntries.id }).from(incomeEntries)
        .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, tr.id), eq(incomeEntries.category, "rental")))
        .limit(1);
      if (!exists[0]) {
        await db.insert(incomeEntries).values({
          userId, taxProfileId: profile.id, taxYearId: tr.taxYearId, taxReturnId: tr.id,
          category: "rental", amountCents: cents,
          description: `Location — ${answers["r_loc_adresse"] ?? "adresse non précisée"} (questionnaire)`,
          isValidated: false, updatedAt: new Date(),
        });
        entriesCreated++;
      }
    }
  }

  // REER (déduction)
  if (answers["ded_reer"] && typeof answers["ded_reer"] === "string") {
    const cents = Math.round(parseFloat(String(answers["ded_reer"]).replace(",", ".")) * 100);
    if (cents > 0) {
      await db.insert(deductionEntries).values({
        userId, taxProfileId: profile.id, taxYearId: tr.taxYearId, taxReturnId: tr.id,
        category: "rrsp", amountCents: cents,
        description: "Cotisation REER (questionnaire)", isValidated: false, updatedAt: new Date(),
      }).onConflictDoNothing();
      entriesCreated++;
    }
  }

  // Mettre à jour pancanadianData avec toutes les réponses et le détail de
  // progression. Le résumé déclaration lit cette même source persistée.
  let existingPancanadianData: Record<string, unknown> = {};
  try {
    existingPancanadianData = JSON.parse(profile.pancanadianData ?? "{}") as Record<string, unknown>;
  } catch {
    // Une ancienne valeur invalide ne doit jamais empêcher la sauvegarde du brouillon.
  }
  await db.update(taxProfiles).set({
    pancanadianData: JSON.stringify({
      ...existingPancanadianData,
      questionnaireAnswers: answers,
      questionnaireProgress: progress ?? null,
    }),
    ...(province ? { fiscalResidence: province } : {}),
    updatedAt: new Date(),
  }).where(eq(taxProfiles.userId, userId));

  // Nouvelle structure questionnaire : conserver une session maître et un
  // audit des réponses, en parallèle du stockage pancanadien historique.
  // Le try/catch permet aux anciens environnements de continuer à sauvegarder
  // avant l’application de la migration 0010.
  try {
    const sessionRows = await db.execute(sql`
      INSERT INTO q_sessions (user_id, tax_profile_id, tax_year_id, tax_return_id, questionnaire_type, province, status, current_step, progress_pct, updated_at)
      VALUES (${userId}, ${profile.id}, ${tr.taxYearId}, ${tr.id}, 'particulier', ${province ?? null}, ${progress?.globalPercent === 100 ? "complete" : "en_cours"}, ${progress?.currentSection ?? currentSection ?? sectionCompleted ?? null}, ${progress?.globalPercent ?? 0}, now())
      ON CONFLICT (tax_return_id, questionnaire_type) DO UPDATE SET
        province = EXCLUDED.province,
        status = EXCLUDED.status,
        current_step = EXCLUDED.current_step,
        progress_pct = EXCLUDED.progress_pct,
        updated_at = now()
      RETURNING id
    `) as unknown as Array<{ id: string }>;
    const qSessionId = sessionRows[0]?.id;
    const previousAnswers = (existingPancanadianData.questionnaireAnswers ?? {}) as Record<string, unknown>;
    if (qSessionId) {
      for (const [questionId, newValue] of Object.entries(answers)) {
        if (JSON.stringify(previousAnswers[questionId]) === JSON.stringify(newValue)) continue;
        await db.execute(sql`
          INSERT INTO q_answer_history (session_id, table_name, question_id, old_value, new_value, changed_by)
          VALUES (${qSessionId}, 'pancanadianData', ${questionId}, ${previousAnswers[questionId] === undefined ? null : JSON.stringify(previousAnswers[questionId])}, ${JSON.stringify(newValue)}, ${userId})
        `);
      }
    }
  } catch {
    // Compatible avec une base où la migration questionnaire n’est pas encore appliquée.
  }

  return NextResponse.json({ ok: true, sessionId, sectionsCompleted, entriesCreated });
}
