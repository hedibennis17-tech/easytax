/**
 * GET /api/ocr-prefill
 * Retourne les données extraites par OCR converties en réponses de questionnaire.
 * Utilisé par le questionnaire pour pré-remplir les sections Profil, Emploi, Déductions, etc.
 *
 * Format de retour: { answers: Record<questionId, value>, slips: SlipSummary[] }
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, fiscalDocuments,
  documentExtractions, extractionFields, documentTypes, incomeEntries,
} from "@/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";

function parseMoney(raw: string | null): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[$,\s]/g, "").replace(",", ".")) || 0;
}

export async function GET() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select({ id: taxProfiles.id, firstName: taxProfiles.firstName, lastName: taxProfiles.lastName, province: taxProfiles.province, fiscalResidence: taxProfiles.fiscalResidence })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile) return NextResponse.json({ answers: {}, slips: [] });

  // Dossier courant
  const [taxReturn] = await db.select({ id: taxReturns.id })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);

  if (!taxReturn) return NextResponse.json({ answers: {}, slips: [] });

  // Tous les docs avec extraction
  const docs = await db.select({
    docId: fiscalDocuments.id,
    typeCode: documentTypes.code,
    typeName: documentTypes.labelFr,
    extractionId: documentExtractions.id,
    status: fiscalDocuments.status,
  }).from(fiscalDocuments)
    .innerJoin(documentExtractions, eq(documentExtractions.fiscalDocumentId, fiscalDocuments.id))
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(and(
      eq(fiscalDocuments.userId, clerkUserId),
      eq(fiscalDocuments.taxReturnId, taxReturn.id),
      isNotNull(documentExtractions.extractedAt),
    ));

  // Construire les réponses pré-remplies
  const answers: Record<string, unknown> = {};

  // Comptes par type de feuillet
  let t4Count = 0;
  let rl1Count = 0;
  let t5Count = 0;
  let t4aCount = 0;

  // Totaux agrégés depuis les incomeEntries validées
  const incomes = await db.select({
    category: incomeEntries.category,
    amountCents: incomeEntries.amountCents,
    employerName: incomeEntries.employerName,
  }).from(incomeEntries)
    .where(and(eq(incomeEntries.userId, clerkUserId), eq(incomeEntries.taxReturnId, taxReturn.id)));

  const totalEmploymentCents = incomes
    .filter(i => i.category === "employment")
    .reduce((s, i) => s + (i.amountCents ?? 0), 0);

  const employers = [...new Set(incomes.filter(i => i.employerName).map(i => i.employerName!))];

  const slipSummaries: Array<{ typeCode: string; typeName: string | null; fields: Array<{ code: string; label: string | null; value: string | null }> }> = [];

  for (const doc of docs) {
    const fields = await db.select({
      code: extractionFields.fieldCode,
      label: extractionFields.fieldLabel,
      value: extractionFields.validatedValue ?? extractionFields.rawOcrValue,
    }).from(extractionFields)
      .where(eq(extractionFields.extractionId, doc.extractionId));

    const fieldMap: Record<string, string> = {};
    for (const f of fields) {
      fieldMap[f.code] = f.value ?? "";
    }

    slipSummaries.push({ typeCode: doc.typeCode ?? "OTHER", typeName: doc.typeName, fields });

    // ── T4 ──────────────────────────────────────────────────────
    if (doc.typeCode === "T4") {
      t4Count++;
      // e2: "Avez-vous reçu un T4?" → OUI
      answers["e2"] = true;
      // Nombre d'employeurs (e1)
      answers["e1"] = t4Count;
    }

    // ── RL-1 ─────────────────────────────────────────────────────
    if (doc.typeCode === "RL-1") {
      rl1Count++;
    }

    // ── T5 ───────────────────────────────────────────────────────
    if (doc.typeCode === "T5") {
      t5Count++;
      const box13 = parseMoney(fieldMap["box_13"]);
      const box11 = parseMoney(fieldMap["box_11"]);
      if (box13 > 0 || box11 > 0) {
        // t4: revenus de placements = vrai (triage)
        answers["t4"] = true;
      }
    }

    // ── T4A ──────────────────────────────────────────────────────
    if (doc.typeCode === "T4A") {
      t4aCount++;
      answers["e6"] = true; // "Avez-vous reçu des T4A?"
    }

    // ── T4E ──────────────────────────────────────────────────────
    if (doc.typeCode === "T4E") {
      answers["r13"] = true; // Prestations AE reçues
    }

    // ── REER ─────────────────────────────────────────────────────
    if (doc.typeCode === "REER" || doc.typeCode === "T4RSP") {
      answers["d1"] = true; // Cotisation REER
    }
  }

  // Pré-remplir triage si on a des T4
  if (t4Count > 0 || rl1Count > 0) {
    answers["t1"] = true; // Revenu d'emploi
  }

  // Pré-remplir emploi avec les données agrégées
  if (totalEmploymentCents > 0) {
    answers["e1"] = Math.max(t4Count, 1);
    answers["e2"] = true;
  }

  // Profil: province depuis le profil fiscal
  if (profile.fiscalResidence || profile.province) {
    answers["profil_province"] = profile.fiscalResidence ?? profile.province;
    answers["province"] = profile.fiscalResidence ?? profile.province;
  }

  return NextResponse.json({
    answers,
    slips: slipSummaries,
    totals: {
      t4Count, rl1Count, t5Count, t4aCount,
      totalEmploymentCents,
      employers,
    },
  });
}
