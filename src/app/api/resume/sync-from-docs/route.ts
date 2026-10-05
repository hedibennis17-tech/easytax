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

  // Tous les documents avec une extraction complète (même sans taxReturnId sur le doc)
  const { taxYears: taxYearsTable } = await import("@/db/schema");
  const [year2025] = await db.select({ id: taxYearsTable.id })
    .from(taxYearsTable).where(eq(taxYearsTable.year, 2025)).limit(1);

  const docs = await db.select({
    docId: fiscalDocuments.id,
    extractionId: documentExtractions.id,
    detectedDocumentTypeId: documentExtractions.detectedDocumentTypeId,
    uploadedDocumentTypeId: fiscalDocuments.documentTypeId,
    docTaxReturnId: fiscalDocuments.taxReturnId,
  }).from(fiscalDocuments)
    .innerJoin(documentExtractions, eq(documentExtractions.fiscalDocumentId, fiscalDocuments.id))
    .where(and(
      eq(fiscalDocuments.userId, clerkUserId),
      isNotNull(documentExtractions.extractedAt),
    ));

  // Lier le taxReturnId manquant aux documents orphelins
  for (const doc of docs.filter(d => !d.docTaxReturnId)) {
    await db.update(fiscalDocuments)
      .set({ taxReturnId: taxReturn.id, updatedAt: new Date() })
      .where(eq(fiscalDocuments.id, doc.docId));
    doc.docTaxReturnId = taxReturn.id;
  }

  let totalCreated = 0;
  const results = [];

  for (const doc of docs) {
    // L'OCR peut corriger un choix initial T4/T4A erroné. Les écritures
    // fiscales doivent toujours suivre ce type détecté, sinon les montants
    // seraient rangés dans les mauvaises catégories de revenu.
    const effectiveDocumentTypeId = doc.detectedDocumentTypeId ?? doc.uploadedDocumentTypeId;
    const [effectiveDocumentType] = effectiveDocumentTypeId
      ? await db.select({ code: documentTypes.code }).from(documentTypes).where(eq(documentTypes.id, effectiveDocumentTypeId)).limit(1)
      : [];
    if (!effectiveDocumentType?.code) continue;

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
      documentTypeCode: effectiveDocumentType.code,
      ocrText: page?.ocrText ?? undefined,
    });

    totalCreated += syncResult.created;
    results.push({ docId: doc.docId, typeCode: effectiveDocumentType.code, ...syncResult });
  }

  return NextResponse.json({ ok: true, totalCreated, docs: results });
}
