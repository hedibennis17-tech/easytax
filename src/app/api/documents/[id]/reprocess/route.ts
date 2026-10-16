/**
 * POST /api/documents/:id/reprocess
 *
 * Re-run l'extraction OCR sur un document déjà en BD.
 * Utilise le texte OCR déjà stocké (pas de re-OCR payant).
 * Écrase les entrées income/deduction/credit existantes.
 *
 * Utile après un fix du parser (dictionnaire.ts) pour appliquer
 * la nouvelle logique aux documents déjà uploadés.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  fiscalDocuments, documentPages, documentExtractions,
  extractionFields, incomeEntries, deductionEntries, creditEntries,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { extractAllBoxes, classifySlip } from "@/lib/ocr/dictionnaire";
import { syncOcrToEntries } from "@/lib/ocr-to-entries";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id: docId } = await params;

  // Vérifier que le document appartient à cet utilisateur
  const [doc] = await db.select({
    id: fiscalDocuments.id,
    nom: fiscalDocuments.originalFilename,
    taxReturnId: fiscalDocuments.taxReturnId,
    status: fiscalDocuments.status,
  })
    .from(fiscalDocuments)
    .where(and(eq(fiscalDocuments.id, docId), eq(fiscalDocuments.userId, userId)))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  if (!doc.taxReturnId) return NextResponse.json({ error: "Document non lié à une déclaration" }, { status: 400 });

  // Texte OCR de la première page
  const [page] = await db.select({ ocrText: documentPages.ocrText })
    .from(documentPages)
    .where(eq(documentPages.documentId, docId))
    .orderBy(documentPages.pageNumber)
    .limit(1);

  if (!page?.ocrText) {
    return NextResponse.json({ error: "Pas de texte OCR en base — re-uploader le document" }, { status: 400 });
  }

  // Extraction enregistrée
  const [extraction] = await db.select({
    id: documentExtractions.id,
    classificationReason: documentExtractions.classificationReason,
    detectedTaxYear: documentExtractions.detectedTaxYear,
  })
    .from(documentExtractions)
    .where(eq(documentExtractions.fiscalDocumentId, docId))
    .limit(1);

  if (!extraction) {
    return NextResponse.json({ error: "Aucune extraction en base — uploader d'abord le document" }, { status: 400 });
  }

  // Détecter le type de feuillet depuis la classification
  const ocrText = page.ocrText;
  const classifFromReason = extraction.classificationReason?.match(
    /\b(T4A?|T5007|T5|T3|RL-\d+|T4E|T2202|T4RSP)\b/i
  )?.[1]?.toUpperCase();
  const classifFromOcr = classifySlip(ocrText);
  const documentTypeCode = classifFromReason ?? classifFromOcr ?? "RL-1";

  // ── Étape 1 : Supprimer les anciennes extractionFields ─────────
  await db.delete(extractionFields)
    .where(eq(extractionFields.extractionId, extraction.id));

  // ── Étape 2 : Re-extraire les boxes avec le code actuel ────────
  const boxes = extractAllBoxes(ocrText, documentTypeCode);
  const nonNullBoxes = boxes.filter(b => b.amountCents !== null || b.rawValue !== null);

  // Réécrire les extractionFields
  if (nonNullBoxes.length > 0) {
    await db.insert(extractionFields).values(
      nonNullBoxes.map(b => ({
        extractionId: extraction.id,
        fieldCode: b.code,
        fieldLabel: b.label_fr,
        rawOcrValue: b.rawValue ?? null,
        ocrConfidence: b.confidence,
        validatedValue: b.rawValue ?? null,
        validationStatus: "confirmed" as const,
        needsReview: false,
      }))
    );
  }

  // ── Étape 3 : Supprimer les anciennes entrées income/deduction/credit ──
  await Promise.all([
    db.delete(incomeEntries).where(
      and(eq(incomeEntries.userId, userId), eq(incomeEntries.sourceDocumentId, docId))
    ),
    db.delete(deductionEntries).where(
      and(eq(deductionEntries.userId, userId), eq(deductionEntries.sourceDocumentId, docId))
    ),
    db.delete(creditEntries).where(
      and(eq(creditEntries.userId, userId), eq(creditEntries.sourceDocumentId, docId))
    ),
  ]);

  // ── Étape 4 : Recréer les entrées avec syncOcrToEntries ────────
  const syncResult = await syncOcrToEntries({
    extractionId: extraction.id,
    documentId: docId,
    userId,
    taxReturnId: doc.taxReturnId,
    documentTypeCode,
    ocrText,
    replaceExisting: true,
  });

  return NextResponse.json({
    success: true,
    document: { id: doc.id, nom: doc.nom },
    type_détecté: documentTypeCode,
    boxes_extraites: nonNullBoxes.length,
    cases: nonNullBoxes.map(b => ({
      code: b.code,
      valeur: b.rawValue,
      montant: b.amountCents !== null ? (b.amountCents / 100).toFixed(2) + " $" : null,
    })),
    entrées_créées: syncResult,
  }, { status: 200 });
}
