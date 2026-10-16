/**
 * POST /api/documents/backfill-meta
 *
 * Backfill employer_name et tax_year dans extractionFields pour les documents
 * existants qui ont une extraction mais pas encore ces champs.
 * Utilise le texte OCR déjà stocké dans documentPages.ocrText — aucun appel
 * à l'OCR externe, aucun coût supplémentaire.
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
import { eq, and, isNull, inArray, notInArray } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { extractSlipMetadata } from "@/lib/ocr/dictionnaire";

export async function POST() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  // Profil de l'utilisateur
  const [profile] = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, ctx.clerkUserId))
    .limit(1);
  if (!profile) return NextResponse.json({ backfilled: 0 });

  // Tous les documents actifs de l'utilisateur
  const docs = await db
    .select({ id: fiscalDocuments.id })
    .from(fiscalDocuments)
    .where(
      and(
        eq(fiscalDocuments.userId, ctx.clerkUserId),
        eq(fiscalDocuments.taxProfileId, profile.id),
        isNull(fiscalDocuments.deletedAt),
      )
    );
  if (docs.length === 0) return NextResponse.json({ backfilled: 0 });

  const docIds = docs.map(d => d.id);

  // Extractions existantes pour ces documents
  const extractions = await db
    .select({ id: documentExtractions.id, fiscalDocumentId: documentExtractions.fiscalDocumentId })
    .from(documentExtractions)
    .where(inArray(documentExtractions.fiscalDocumentId, docIds));
  if (extractions.length === 0) return NextResponse.json({ backfilled: 0 });

  const extractionIds = extractions.map(e => e.id);
  const extractionToDoc: Record<string, string> = {};
  for (const ex of extractions) extractionToDoc[ex.id] = ex.fiscalDocumentId;
  const docToExtraction: Record<string, string> = {};
  for (const ex of extractions) docToExtraction[ex.fiscalDocumentId] = ex.id;

  // Champs déjà présents (employer_name ou tax_year) pour ces extractions
  const existing = await db
    .select({ extractionId: extractionFields.extractionId, fieldCode: extractionFields.fieldCode })
    .from(extractionFields)
    .where(
      and(
        inArray(extractionFields.extractionId, extractionIds),
        inArray(extractionFields.fieldCode, ["employer_name", "tax_year"]),
      )
    );

  // Construire un Set des champs déjà présents : "extractionId:fieldCode"
  const alreadyHas = new Set(existing.map(f => `${f.extractionId}:${f.fieldCode}`));

  // Extractions qui manquent au moins un des deux champs
  const needsBackfill = extractions.filter(ex =>
    !alreadyHas.has(`${ex.id}:employer_name`) || !alreadyHas.has(`${ex.id}:tax_year`)
  );
  if (needsBackfill.length === 0) return NextResponse.json({ backfilled: 0, message: "Tous les champs sont déjà présents." });

  const needsDocIds = needsBackfill.map(ex => ex.fiscalDocumentId);

  // Texte OCR stocké dans documentPages pour ces documents
  const pages = await db
    .select({ documentId: documentPages.documentId, ocrText: documentPages.ocrText })
    .from(documentPages)
    .where(inArray(documentPages.documentId, needsDocIds));

  // Agréger le texte OCR par document (concatener toutes les pages)
  const ocrByDoc: Record<string, string> = {};
  for (const page of pages) {
    if (page.ocrText) {
      ocrByDoc[page.documentId] = (ocrByDoc[page.documentId] ?? "") + "\n" + page.ocrText;
    }
  }

  let backfilled = 0;
  const inserts: Array<Parameters<typeof db.insert>[0] extends never ? never : {
    extractionId: string;
    fieldCode: string;
    fieldLabel: string;
    pageNumber: number;
    rawOcrValue: string;
    ocrConfidence: number;
    needsReview: boolean;
    isRequired: boolean;
    validationStatus: "unreviewed";
  }> = [];

  for (const ex of needsBackfill) {
    const ocrText = ocrByDoc[ex.fiscalDocumentId];
    if (!ocrText?.trim()) continue;

    const meta = extractSlipMetadata(ocrText);

    if (meta.employerName && !alreadyHas.has(`${ex.id}:employer_name`)) {
      inserts.push({
        extractionId: ex.id,
        fieldCode: "employer_name",
        fieldLabel: "Nom du payeur",
        pageNumber: 1,
        rawOcrValue: meta.employerName,
        ocrConfidence: 80,
        needsReview: false,
        isRequired: true,
        validationStatus: "unreviewed",
      });
      backfilled++;
    }

    if (meta.taxYear && !alreadyHas.has(`${ex.id}:tax_year`)) {
      inserts.push({
        extractionId: ex.id,
        fieldCode: "tax_year",
        fieldLabel: "Année fiscale",
        pageNumber: 1,
        rawOcrValue: String(meta.taxYear),
        ocrConfidence: 85,
        needsReview: false,
        isRequired: true,
        validationStatus: "unreviewed",
      });
    }
  }

  if (inserts.length > 0) {
    await db.insert(extractionFields).values(inserts);
  }

  return NextResponse.json({
    backfilled,
    docsChecked: needsBackfill.length,
    fieldsInserted: inserts.length,
  });
}
