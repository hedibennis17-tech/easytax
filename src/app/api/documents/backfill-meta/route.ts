/**
 * POST /api/documents/backfill-meta
 *
 * - Supprime les doublons employer_name / tax_year (garde le meilleur par code)
 * - Backfille les champs manquants depuis le texte OCR stocké (documentPages.ocrText)
 * - Aucun appel OCR externe, aucun coût
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  fiscalDocuments,
  documentExtractions,
  extractionFields,
  documentPages,
  taxProfiles,
} from "@/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { extractSlipMetadata } from "@/lib/ocr/dictionnaire";

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const [profile] = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, ctx.clerkUserId))
    .limit(1);
  if (!profile) return NextResponse.json({ deduped: 0, backfilled: 0 });

  // Documents actifs de l'utilisateur
  const docs = await db
    .select({ id: fiscalDocuments.id })
    .from(fiscalDocuments)
    .where(and(
      eq(fiscalDocuments.userId, ctx.clerkUserId),
      eq(fiscalDocuments.taxProfileId, profile.id),
      isNull(fiscalDocuments.deletedAt),
    ));
  if (docs.length === 0) return NextResponse.json({ deduped: 0, backfilled: 0 });

  const docIds = docs.map(d => d.id);

  // Extractions pour ces documents
  const extractions = await db
    .select({ id: documentExtractions.id, fiscalDocumentId: documentExtractions.fiscalDocumentId })
    .from(documentExtractions)
    .where(inArray(documentExtractions.fiscalDocumentId, docIds));
  if (extractions.length === 0) return NextResponse.json({ deduped: 0, backfilled: 0 });

  const extractionIds = extractions.map(e => e.id);
  const docToExtraction: Record<string, string> = {};
  for (const ex of extractions) docToExtraction[ex.fiscalDocumentId] = ex.id;

  // Tous les champs employer_name / tax_year existants (avec valeur ou non)
  const metaFields = await db
    .select({
      id: extractionFields.id,
      extractionId: extractionFields.extractionId,
      fieldCode: extractionFields.fieldCode,
      rawOcrValue: extractionFields.rawOcrValue,
    })
    .from(extractionFields)
    .where(and(
      inArray(extractionFields.extractionId, extractionIds),
      inArray(extractionFields.fieldCode, ["employer_name", "tax_year"]),
    ));

  // ── Étape 1 : dédupliquer ─────────────────────────────────────────────────
  // Par extraction+fieldCode, garder l'enregistrement avec la valeur non-nulle la plus longue
  const byKey: Record<string, typeof metaFields> = {};
  for (const f of metaFields) {
    const key = `${f.extractionId}:${f.fieldCode}`;
    byKey[key] = [...(byKey[key] ?? []), f];
  }

  let deduped = 0;
  const toDelete: string[] = [];
  // Map "extractionId:fieldCode" → meilleure valeur gardée
  const bestValue: Record<string, string | null> = {};

  for (const [key, group] of Object.entries(byKey)) {
    if (group.length <= 1) {
      // Un seul — noter la valeur
      bestValue[key] = group[0].rawOcrValue ?? null;
      continue;
    }
    // Plusieurs — garder celui avec la meilleure valeur (non-nulle, la plus longue)
    const sorted = [...group].sort((a, b) => {
      const aLen = a.rawOcrValue?.length ?? 0;
      const bLen = b.rawOcrValue?.length ?? 0;
      return bLen - aLen; // descending
    });
    bestValue[key] = sorted[0].rawOcrValue ?? null;
    // Supprimer tous sauf le premier
    for (const dup of sorted.slice(1)) toDelete.push(dup.id);
    deduped += sorted.length - 1;
  }

  if (toDelete.length > 0) {
    await db.delete(extractionFields).where(inArray(extractionFields.id, toDelete));
  }

  // ── Étape 2 : backfill des champs manquants ou sans valeur ───────────────
  // On doit backfiller si : champ absent OU valeur null/"Nom du payeur" (placeholder)
  const PLACEHOLDER = "Nom du payeur";
  const needsBackfill = extractions.filter(ex => {
    const empKey = `${ex.id}:employer_name`;
    const yrKey = `${ex.id}:tax_year`;
    const empMissing = !(empKey in bestValue) || !bestValue[empKey] || bestValue[empKey] === PLACEHOLDER;
    const yrMissing = !(yrKey in bestValue) || !bestValue[yrKey];
    return empMissing || yrMissing;
  });

  if (needsBackfill.length === 0) {
    return NextResponse.json({ deduped, backfilled: 0, message: "Tout est propre." });
  }

  const needsDocIds = needsBackfill.map(ex => ex.fiscalDocumentId);

  // Texte OCR stocké
  const pages = await db
    .select({ documentId: documentPages.documentId, ocrText: documentPages.ocrText })
    .from(documentPages)
    .where(inArray(documentPages.documentId, needsDocIds));

  const ocrByDoc: Record<string, string> = {};
  for (const page of pages) {
    if (page.ocrText) ocrByDoc[page.documentId] = (ocrByDoc[page.documentId] ?? "") + "\n" + page.ocrText;
  }

  let backfilled = 0;
  const inserts: {
    extractionId: string; fieldCode: string; fieldLabel: string;
    pageNumber: number; rawOcrValue: string; ocrConfidence: number;
    needsReview: boolean; isRequired: boolean; validationStatus: "unreviewed";
  }[] = [];

  // Ids à mettre à jour si la valeur était un placeholder
  const toUpdate: { id: string; rawOcrValue: string }[] = [];

  for (const ex of needsBackfill) {
    const ocrText = ocrByDoc[ex.fiscalDocumentId];
    if (!ocrText?.trim()) continue;

    const meta = extractSlipMetadata(ocrText);
    const empKey = `${ex.id}:employer_name`;
    const yrKey = `${ex.id}:tax_year`;

    // employer_name
    if (meta.employerName) {
      const existing = metaFields.find(f => f.extractionId === ex.id && f.fieldCode === "employer_name" && !toDelete.includes(f.id));
      if (!existing) {
        inserts.push({ extractionId: ex.id, fieldCode: "employer_name", fieldLabel: "Nom du payeur", pageNumber: 1, rawOcrValue: meta.employerName, ocrConfidence: 80, needsReview: false, isRequired: true, validationStatus: "unreviewed" });
        backfilled++;
      } else if (!existing.rawOcrValue || existing.rawOcrValue === PLACEHOLDER) {
        toUpdate.push({ id: existing.id, rawOcrValue: meta.employerName });
        backfilled++;
      }
    }

    // tax_year
    if (meta.taxYear) {
      const existing = metaFields.find(f => f.extractionId === ex.id && f.fieldCode === "tax_year" && !toDelete.includes(f.id));
      if (!existing) {
        inserts.push({ extractionId: ex.id, fieldCode: "tax_year", fieldLabel: "Année fiscale", pageNumber: 1, rawOcrValue: String(meta.taxYear), ocrConfidence: 85, needsReview: false, isRequired: true, validationStatus: "unreviewed" });
      } else if (!existing.rawOcrValue) {
        toUpdate.push({ id: existing.id, rawOcrValue: String(meta.taxYear) });
      }
    }
  }

  if (inserts.length > 0) await db.insert(extractionFields).values(inserts);
  for (const u of toUpdate) {
    await db.update(extractionFields).set({ rawOcrValue: u.rawOcrValue }).where(eq(extractionFields.id, u.id));
  }

  return NextResponse.json({ deduped, backfilled, fieldsInserted: inserts.length, fieldsUpdated: toUpdate.length });
}
