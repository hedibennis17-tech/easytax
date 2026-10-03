/**
 * POST /api/resume/sync-from-docs
 * Re-synchronise les données OCR déjà extraites vers incomeEntries/deductionEntries.
 * Utile quand des documents ont été traités AVANT l'ajout de ocr-to-entries.
 * Idempotent — ne crée pas de doublons.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, fiscalDocuments, documentExtractions,
  documentTypes, taxReturns,
} from "@/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { syncOcrToEntries } from "@/lib/ocr-to-entries";

export async function POST() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Trouver le dossier courant
  const [taxReturn] = await db.select({ id: taxReturns.id })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);

  if (!taxReturn) return NextResponse.json({ error: "Aucun dossier fiscal", created: 0 });

  // Tous les documents avec une extraction complète
  const docs = await db.select({
    docId: fiscalDocuments.id,
    typeCode: documentTypes.code,
    extractionId: documentExtractions.id,
  }).from(fiscalDocuments)
    .innerJoin(documentExtractions, eq(documentExtractions.fiscalDocumentId, fiscalDocuments.id))
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(and(
      eq(fiscalDocuments.userId, clerkUserId),
      eq(fiscalDocuments.taxReturnId, taxReturn.id),
      isNotNull(documentExtractions.extractedAt),
    ));

  let totalCreated = 0;
  const results = [];

  for (const doc of docs) {
    if (!doc.typeCode) continue;

    // Récupérer le texte OCR depuis les pages
    const { documentPages } = await import("@/db/schema");
    const [page] = await db.select({ ocrText: documentPages.ocrText })
      .from(documentPages)
      .where(eq(documentPages.documentId, doc.docId))
      .limit(1);

    const syncResult = await syncOcrToEntries({
      extractionId: doc.extractionId,
      documentId: doc.docId,
      userId: clerkUserId,
      taxReturnId: taxReturn.id,
      documentTypeCode: doc.typeCode,
      ocrText: page?.ocrText ?? undefined,
    });

    totalCreated += syncResult.created;
    results.push({ docId: doc.docId, typeCode: doc.typeCode, ...syncResult });
  }

  return NextResponse.json({ ok: true, totalCreated, docs: results });
}
