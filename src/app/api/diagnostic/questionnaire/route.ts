import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, taxYears,
  questionnaireSessions, incomeEntries, deductionEntries, creditEntries,
  fiscalDocuments, documentTypes, documentExtractions, extractionFields, documentPages,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const ok: string[] = [];
  const warn: string[] = [];
  const errors: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  // ── 1. PROFIL ─────────────────────────────────────────────────────────────
  const [profile] = await db.select().from(taxProfiles)
    .where(eq(taxProfiles.userId, userId)).limit(1);

  if (!profile) {
    errors.push("PROFIL: Aucun taxProfile trouvé → création de compte incomplète");
  } else {
    ok.push(`PROFIL: ${profile.firstName} ${profile.lastName}`);
    data.profil = {
      id: profile.id.slice(0,8),
      nom: `${profile.firstName} ${profile.lastName}`,
      province: profile.province,
      fiscalResidence: profile.fiscalResidence,
      maritalStatus: profile.maritalStatus,
      dateOfBirth: profile.dateOfBirth,
      sinLastFour: profile.sinLastFour ? `···· ${profile.sinLastFour}` : null,
      adresse: profile.address,
      ville: profile.city,
      codePostal: profile.postalCode,
      telephone: profile.phone,
      email: profile.email,
      // Champs manquants
      manquants: [
        !profile.province && "province",
        !profile.address && "adresse",
        !profile.city && "ville",
        !profile.postalCode && "codePostal",
        !profile.dateOfBirth && "dateNaissance",
        !profile.sinLastFour && "NAS",
      ].filter(Boolean),
    };
    if (data.profil.manquants.length > 0)
      warn.push(`PROFIL: Champs manquants → ${data.profil.manquants.join(", ")}`);

    // Famille depuis pancanadianData
    let panData: Record<string, unknown> = {};
    try { panData = JSON.parse(profile.pancanadianData ?? "{}") as Record<string, unknown>; } catch { /**/ }
    const members = (panData.members as unknown[] | undefined) ?? [];
    data.famille = {
      etatCivil: profile.maritalStatus,
      membres: members,
      nbMembres: members.length,
      reponsesQuestionnaire: panData.questionnaireAnswers
        ? Object.keys(panData.questionnaireAnswers as object).length
        : 0,
    };
    if (members.length === 0 && profile.maritalStatus !== "single")
      warn.push("FAMILLE: État civil non-célibataire mais aucun membre de famille enregistré");
  }

  // ── 2. TAX RETURN ─────────────────────────────────────────────────────────
  const [tr] = profile
    ? await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId, status: taxReturns.status })
        .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
        .orderBy(desc(taxReturns.updatedAt)).limit(1)
    : [null];

  if (!tr) {
    errors.push("TAX RETURN: Aucun taxReturn → upload impossible, déclaration impossible");
  } else {
    ok.push(`TAX RETURN: ${tr.id.slice(0,8)} status=${tr.status}`);
    data.taxReturn = { id: tr.id.slice(0,8), status: tr.status };
  }

  // ── 3. SESSION QUESTIONNAIRE ───────────────────────────────────────────────
  const [session] = tr
    ? await db.select().from(questionnaireSessions)
        .where(and(eq(questionnaireSessions.userId, userId), eq(questionnaireSessions.taxReturnId, tr.id)))
        .limit(1)
    : [null];

  if (!session) {
    warn.push("SESSION: Aucune session questionnaire en DB → le questionnaire n'a pas encore été sauvegardé");
    data.session = null;
  } else {
    let sectionsCompleted: string[] = [];
    try { sectionsCompleted = JSON.parse(session.sectionsCompleted as string ?? "[]"); } catch { /**/ }
    ok.push(`SESSION: ${sectionsCompleted.length} section(s) complétée(s): ${sectionsCompleted.join(", ") || "aucune"}`);
    data.session = {
      id: session.id.slice(0,8),
      status: session.status,
      sectionsCompleted,
      questionsAnswered: session.questionsAnswered,
      currentSection: session.currentSection,
      situation: {
        emploi:     session.hasEmploymentIncome,
        autonome:   session.hasSelfEmployment,
        placements: session.hasInvestmentIncome,
        location:   session.hasRentalIncome,
        reer:       session.hasRrsp,
        garde:      session.hasChildcare,
      },
    };
    const requiredSections = ["triage", "profil", "revenus"];
    const missingSections = requiredSections.filter(s => !sectionsCompleted.includes(s));
    if (missingSections.length > 0)
      warn.push(`SESSION: Sections manquantes → ${missingSections.join(", ")}`);
  }

  // ── 4. DOCUMENTS & OCR ────────────────────────────────────────────────────
  const docs = tr
    ? await db.select({
        id: fiscalDocuments.id, status: fiscalDocuments.status,
        typeCode: documentTypes.code, updatedAt: fiscalDocuments.updatedAt,
      }).from(fiscalDocuments)
        .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
        .where(and(eq(fiscalDocuments.userId, userId), eq(fiscalDocuments.taxReturnId, tr.id)))
    : [];

  data.documents = [];
  for (const doc of docs) {
    const [ext] = await db.select({ id: documentExtractions.id, status: documentExtractions.status, conf: documentExtractions.overallConfidence, error: documentExtractions.errorMessage })
      .from(documentExtractions).where(eq(documentExtractions.fiscalDocumentId, doc.id)).limit(1);
    const fields = ext ? await db.select({ code: extractionFields.fieldCode, value: extractionFields.rawOcrValue })
      .from(extractionFields).where(eq(extractionFields.extractionId, ext.id)) : [];
    const pages = await db.select({ len: documentPages.ocrText })
      .from(documentPages).where(eq(documentPages.documentId, doc.id)).limit(1);
    const fieldsWithValue = fields.filter(f => f.value && f.value.trim());

    data.documents.push({
      id: doc.id.slice(0,8),
      type: doc.typeCode ?? "OTHER",
      status: doc.status,
      extraction: ext ? { status: ext.status, conf: ext.conf, error: ext.error } : "ABSENTE",
      fieldsTotal: fields.length,
      fieldsWithValue: fieldsWithValue.length,
      ocrTextLen: pages[0]?.len?.length ?? 0,
      fields: fieldsWithValue.slice(0, 5),
    });

    if (doc.status === "processing_failed") errors.push(`DOC ${doc.id.slice(0,8)} (${doc.typeCode}): processing_failed${ext?.error ? " → " + ext.error.slice(0,80) : ""}`);
    else if (fieldsWithValue.length === 0 && (pages[0]?.len?.length ?? 0) > 100) warn.push(`DOC ${doc.id.slice(0,8)} (${doc.typeCode}): OCR texte présent mais 0 champs extraits`);
    else if (fieldsWithValue.length > 0) ok.push(`DOC ${doc.id.slice(0,8)} (${doc.typeCode}): ${fieldsWithValue.length} champ(s) extrait(s)`);
  }

  if (docs.length === 0) warn.push("DOCUMENTS: Aucun document uploadé");

  // ── 5. REVENUS EN DB ──────────────────────────────────────────────────────
  const incomes = tr
    ? await db.select().from(incomeEntries)
        .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, tr.id)))
    : [];

  const totalRevCents = incomes.reduce((s, i) => s + (i.amountCents ?? 0), 0);
  data.revenus = {
    count: incomes.length,
    total: (totalRevCents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) + " $",
    entries: incomes.map(i => ({
      categorie: i.category,
      montant: ((i.amountCents ?? 0) / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) + " $",
      source: i.sourceType,
      valide: i.isValidated,
      description: i.description?.slice(0, 60),
    })),
  };

  if (incomes.length === 0) warn.push("REVENUS: 0 incomeEntries en DB → feuillets pas encore validés ou questionnaire pas sauvegardé");
  else ok.push(`REVENUS: ${incomes.length} entrée(s) — total ${data.revenus.total}`);

  // ── 6. DÉDUCTIONS EN DB ───────────────────────────────────────────────────
  const deds = tr
    ? await db.select().from(deductionEntries)
        .where(and(eq(deductionEntries.userId, userId), eq(deductionEntries.taxReturnId, tr.id)))
    : [];

  data.deductions = { count: deds.length, entries: deds.map(d => ({ categorie: d.category, montant: ((d.amountCents ?? 0) / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) + " $", valide: d.isValidated })) };
  if (deds.length === 0) warn.push("DÉDUCTIONS: 0 deductionEntries — impôt retenu et cotisations syndicales non enregistrés");
  else ok.push(`DÉDUCTIONS: ${deds.length} entrée(s)`);

  // ── 7. CRÉDITS ─────────────────────────────────────────────────────────────
  const creds = tr
    ? await db.select().from(creditEntries)
        .where(and(eq(creditEntries.userId, userId), eq(creditEntries.taxReturnId, tr.id)))
    : [];
  data.credits = { count: creds.length };
  if (creds.length === 0) warn.push("CRÉDITS: 0 creditEntries — section crédits pas encore complétée");
  else ok.push(`CRÉDITS: ${creds.length} entrée(s)`);

  // ── 8. PRÊT POUR DÉCLARATION ───────────────────────────────────────────────
  const pret = !!profile && !!tr && incomes.length > 0;
  data.pretPourDeclaration = {
    pret,
    conditions: {
      profil: !!profile,
      taxReturn: !!tr,
      revenus: incomes.length > 0,
      auMoinsUnDocument: docs.length > 0,
    },
    urlDeclaration: "/declaration",
    urlResume: "/api/questionnaire/resume",
  };

  if (pret) ok.push("PRÊT: La déclaration peut être générée → /declaration");
  else warn.push(`PAS PRÊT: Manque → ${[!profile && "profil", !tr && "taxReturn", incomes.length === 0 && "revenus"].filter(Boolean).join(", ")}`);

  return NextResponse.json({
    ok: errors.length === 0,
    résumé: { ok: ok.length, warnings: warn.length, errors: errors.length },
    ok_list: ok,
    warnings: warn,
    errors,
    data,
  });
}
