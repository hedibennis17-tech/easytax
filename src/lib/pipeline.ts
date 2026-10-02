/**
 * Pipeline OCR EasyTax
 *
 * DOCUMENT ORIGINAL (intact)
 *   ↓ OCR par page
 *   ↓ Classification
 *   ↓ Extraction structurée
 *   ↓ Calcul confiance
 *   ↓ Flag review si nécessaire
 *   ↓ Persistance en DB
 *   (jamais l'original modifié)
 */

import { db } from "@/lib/db";
import {
  fiscalDocuments,
  documentPages,
  documentExtractions,
  extractionFields,
  documentAuditLogs,
  documentTypes,
  jurisdictions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOcrProvider } from "@/lib/ocr/provider";
import { classifyDocument } from "@/lib/extractors/base";
import { getExtractor } from "@/lib/extractors/t4";
import { getSignedDownloadUrl } from "@/lib/storage";

export type PipelineStatus =
  | "started"
  | "ocr_completed"
  | "classified"
  | "extracted"
  | "needs_review"
  | "completed"
  | "failed";

export interface PipelineResult {
  status: PipelineStatus;
  extractionId?: string;
  overallConfidence?: number;
  needsHumanReview?: boolean;
  detectedType?: string;
  detectedYear?: number | null;
  error?: string;
}

/**
 * Lancer le pipeline complet pour un document
 * Appelé par POST /api/documents/[id]/process
 */
export async function runOcrPipeline(params: {
  documentId: string;
  userId: string;
  taxYear?: number;
}): Promise<PipelineResult> {
  const { documentId, userId, taxYear } = params;

  // 1. Charger le document — vérifier ownership
  const docRows = await db
    .select()
    .from(fiscalDocuments)
    .where(eq(fiscalDocuments.id, documentId))
    .limit(1);

  if (!docRows[0]) return { status: "failed", error: "Document introuvable" };
  const doc = docRows[0];

  // Vérification ownership stricte
  if (doc.userId !== userId) return { status: "failed", error: "Accès refusé" };

  // Marquer comme en traitement
  await db
    .update(fiscalDocuments)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(fiscalDocuments.id, documentId));

  await db.insert(documentAuditLogs).values({
    documentId,
    userId,
    action: "document_ocr_started",
    metadata: JSON.stringify({ documentId, mimeType: doc.mimeType }),
  });

  try {
    // 2. Télécharger le fichier depuis Neon Storage
    const signedUrl = await getSignedDownloadUrl(doc.storageKey, 300);
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error("Impossible de télécharger le document");
    const buffer = Buffer.from(await response.arrayBuffer());

    // 3. OCR
    const ocrProvider = await getOcrProvider();
    const ocrResult = await ocrProvider.processDocument({
      buffer,
      mimeType: doc.mimeType,
      documentId,
    });

    // 4. Persister les résultats OCR par page
    for (const page of ocrResult.pages) {
      // Vérifier si la page existe déjà
      const existing = await db
        .select({ id: documentPages.id })
        .from(documentPages)
        .where(eq(documentPages.documentId, documentId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(documentPages).values({
          documentId,
          pageNumber: page.pageNumber,
          ocrStatus: page.error ? "failed" : "completed",
          ocrText: page.text,
          ocrConfidence: page.confidence,
          ocrCompletedAt: new Date(),
          ocrError: page.error ?? null,
        });
      } else {
        await db
          .update(documentPages)
          .set({
            ocrStatus: page.error ? "failed" : "completed",
            ocrText: page.text,
            ocrConfidence: page.confidence,
            ocrCompletedAt: new Date(),
            ocrError: page.error ?? null,
          })
          .where(eq(documentPages.documentId, documentId));
      }
    }

    await db.insert(documentAuditLogs).values({
      documentId,
      userId,
      action: "document_ocr_completed",
      metadata: JSON.stringify({
        provider: ocrResult.provider,
        pageCount: ocrResult.pages.length,
        overallConfidence: ocrResult.overallConfidence,
      }),
    });

    // 5. Classification
    const classification = classifyDocument(ocrResult.fullText);

    await db.insert(documentAuditLogs).values({
      documentId,
      userId,
      action: "document_classified",
      metadata: JSON.stringify({
        documentTypeCode: classification.documentTypeCode,
        confidence: classification.confidence,
      }),
    });

    // Résoudre l'ID du type détecté
    let detectedDocumentTypeId: string | null = null;
    if (classification.documentTypeCode) {
      const typeRows = await db
        .select({ id: documentTypes.id })
        .from(documentTypes)
        .where(eq(documentTypes.code, classification.documentTypeCode))
        .limit(1);
      detectedDocumentTypeId = typeRows[0]?.id ?? null;
    }

    // Résoudre l'ID de juridiction
    let detectedJurisdictionId: string | null = null;
    if (classification.detectedJurisdictionCode) {
      const jRows = await db
        .select({ id: jurisdictions.id })
        .from(jurisdictions)
        .where(eq(jurisdictions.code, classification.detectedJurisdictionCode))
        .limit(1);
      detectedJurisdictionId = jRows[0]?.id ?? null;
    }

    // 6. Extraction spécialisée
    await db.insert(documentAuditLogs).values({
      documentId,
      userId,
      action: "document_extraction_started",
      metadata: JSON.stringify({ documentTypeCode: classification.documentTypeCode }),
    });

    let extractionResult = null;
    const extractor = classification.documentTypeCode
      ? getExtractor(classification.documentTypeCode)
      : null;

    if (extractor) {
      extractionResult = extractor.extract(ocrResult.fullText, taxYear);
    }

    // 7. Créer l'enregistrement d'extraction
    const [extraction] = await db
      .insert(documentExtractions)
      .values({
        fiscalDocumentId: documentId,
        userId,
        detectedDocumentTypeId,
        classificationConfidence: classification.confidence,
        classificationReason: classification.reason,
        detectedTaxYear: classification.detectedTaxYear,
        detectedJurisdictionId,
        status: extractionResult ? "completed" : "needs_review",
        ocrProvider: ocrResult.provider,
        overallConfidence: extractionResult?.overallConfidence ?? ocrResult.overallConfidence,
        needsHumanReview: extractionResult?.needsHumanReview ?? true,
        yearMismatchWarning: extractionResult?.yearMismatchWarning ?? false,
        processingStartedAt: new Date(),
        ocrCompletedAt: new Date(),
        classifiedAt: new Date(),
        extractedAt: extractionResult ? new Date() : null,
      })
      .returning({ id: documentExtractions.id });

    // 8. Persister les champs extraits
    if (extractionResult?.fields.length) {
      for (const field of extractionResult.fields) {
        await db.insert(extractionFields).values({
          extractionId: extraction.id,
          fieldCode: field.fieldCode,
          fieldLabel: field.fieldLabel,
          pageNumber: field.pageNumber ?? 1,
          rawOcrValue: field.rawOcrValue,
          ocrConfidence: field.confidence,
          needsReview: field.needsReview,
          isRequired: field.isRequired,
          validationStatus: "unreviewed",
        });
      }
    }

    // 9. Mettre à jour le statut du document
    const finalStatus = extractionResult
      ? extractionResult.needsHumanReview
        ? "needs_review"
        : "extracted"
      : "needs_review";

    await db
      .update(fiscalDocuments)
      .set({ status: finalStatus, updatedAt: new Date() })
      .where(eq(fiscalDocuments.id, documentId));

    await db.insert(documentAuditLogs).values({
      documentId,
      userId,
      action: "document_extraction_completed",
      metadata: JSON.stringify({
        extractionId: extraction.id,
        fieldsCount: extractionResult?.fields.length ?? 0,
        overallConfidence: extractionResult?.overallConfidence ?? 0,
        needsHumanReview: extractionResult?.needsHumanReview ?? true,
      }),
    });

    return {
      status: extractionResult?.needsHumanReview ? "needs_review" : "completed",
      extractionId: extraction.id,
      overallConfidence: extractionResult?.overallConfidence ?? ocrResult.overallConfidence,
      needsHumanReview: extractionResult?.needsHumanReview ?? true,
      detectedType: classification.documentTypeCode ?? undefined,
      detectedYear: classification.detectedTaxYear,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erreur inconnue";

    await db
      .update(fiscalDocuments)
      .set({ status: "processing_failed", updatedAt: new Date() })
      .where(eq(fiscalDocuments.id, documentId));

    await db.insert(documentAuditLogs).values({
      documentId,
      userId,
      action: "document_ocr_failed",
      metadata: JSON.stringify({ error: errorMsg }),
    });

    return { status: "failed", error: errorMsg };
  }
}
