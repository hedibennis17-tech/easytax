import { db } from "@/lib/db";
import {
  fiscalDocuments, documentPages, documentExtractions,
  extractionFields, documentAuditLogs, documentTypes, jurisdictions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOcrProvider } from "@/lib/ocr/provider";
import { classifyDocument } from "@/lib/extractors/base";
import { getExtractor } from "@/lib/extractors/t4";
import { s3 } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export type PipelineStatus = "started" | "ocr_completed" | "classified" | "extracted" | "needs_review" | "completed" | "failed";

export interface PipelineResult {
  status: PipelineStatus;
  extractionId?: string;
  overallConfidence?: number;
  needsHumanReview?: boolean;
  detectedType?: string;
  detectedYear?: number | null;
  entriesCreated?: number;
  error?: string;
}

async function writeAudit(documentId: string, userId: string, action: string, metadata: Record<string, unknown>) {
  try {
    await db.insert(documentAuditLogs).values({
      documentId,
      userId,
      action: action as never,
      metadata: JSON.stringify(metadata),
    });
  } catch (error) {
    // Un journal ne doit jamais empêcher le traitement fiscal du document.
    console.warn("[ocr] Audit log skipped", { action, error: error instanceof Error ? error.message : String(error) });
  }
}

export async function runOcrPipeline(params: { documentId: string; userId: string; taxYear?: number }): Promise<PipelineResult> {
  const { documentId, userId, taxYear } = params;

  const docRows = await db.select({
    document: fiscalDocuments,
    uploadedTypeCode: documentTypes.code,
  })
    .from(fiscalDocuments)
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(eq(fiscalDocuments.id, documentId))
    .limit(1);
  if (!docRows[0]) return { status: "failed", error: "Document introuvable" };
  const { document: doc, uploadedTypeCode } = docRows[0];
  if (doc.userId !== userId) return { status: "failed", error: "Accès refusé" };

  await db.update(fiscalDocuments).set({ status: "processing", updatedAt: new Date() }).where(eq(fiscalDocuments.id, documentId));
  await writeAudit(documentId, userId, "document_ocr_started", { mimeType: doc.mimeType });

  try {
    // Télécharger depuis S3 directement (pas via signed URL pour éviter les problèmes réseau)
    const s3Response = await s3.send(new GetObjectCommand({
      Bucket: process.env.NEON_STORAGE_BUCKET ?? "uploads",
      Key: doc.storageKey,
    }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of s3Response.Body as any) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // OCR
    const ocrProvider = await getOcrProvider();
    const ocrResult = await ocrProvider.processDocument({ buffer, mimeType: doc.mimeType, documentId });

    // Persister pages OCR
    for (const page of ocrResult.pages) {
      const existing = await db.select({ id: documentPages.id }).from(documentPages).where(eq(documentPages.documentId, documentId)).limit(1);
      if (existing.length === 0) {
        await db.insert(documentPages).values({
          documentId, pageNumber: page.pageNumber,
          ocrStatus: page.error ? "failed" : "completed",
          ocrText: page.text, ocrConfidence: page.confidence,
          ocrCompletedAt: new Date(), ocrError: page.error ?? null,
        });
      } else {
        await db.update(documentPages).set({
          ocrStatus: page.error ? "failed" : "completed",
          ocrText: page.text, ocrConfidence: page.confidence,
          ocrCompletedAt: new Date(), ocrError: page.error ?? null,
        }).where(eq(documentPages.documentId, documentId));
      }
    }

    await writeAudit(documentId, userId, "document_ocr_completed", {
      provider: ocrResult.provider,
      pageCount: ocrResult.pages.length,
      pagesWithText: ocrResult.pages.filter(page => Boolean(page.text.trim())).length,
      textLength: ocrResult.fullText.length,
      confidence: ocrResult.overallConfidence,
    });

    // Le type explicitement choisi par le client est prioritaire sur une classification OCR incertaine.
    const ocrClassification = classifyDocument(ocrResult.fullText);
    const selectedTypeHasExtractor = Boolean(uploadedTypeCode && uploadedTypeCode !== "OTHER" && getExtractor(uploadedTypeCode));
    const typeConflict = selectedTypeHasExtractor && Boolean(
      ocrClassification.documentTypeCode && ocrClassification.documentTypeCode !== uploadedTypeCode,
    );
    const classification = selectedTypeHasExtractor
      ? {
          ...ocrClassification,
          documentTypeCode: uploadedTypeCode,
          confidence: ocrClassification.documentTypeCode === uploadedTypeCode
            ? Math.max(ocrClassification.confidence, 95)
            : 100,
          reason: typeConflict
            ? `Type ${uploadedTypeCode} choisi au téléversement (OCR suggérait ${ocrClassification.documentTypeCode}).`
            : `Type ${uploadedTypeCode} confirmé par le choix de téléversement.`,
        }
      : ocrClassification;
    await writeAudit(documentId, userId, "document_classified", {
      typeCode: classification.documentTypeCode,
      confidence: classification.confidence,
      uploadedTypeCode: uploadedTypeCode ?? null,
      ocrSuggestedType: ocrClassification.documentTypeCode,
      typeConflict,
    });

    // Résoudre IDs
    let detectedDocumentTypeId: string | null = null;
    if (classification.documentTypeCode) {
      const typeRows = await db.select({ id: documentTypes.id }).from(documentTypes).where(eq(documentTypes.code, classification.documentTypeCode)).limit(1);
      detectedDocumentTypeId = typeRows[0]?.id ?? null;
    }
    let detectedJurisdictionId: string | null = null;
    if (classification.detectedJurisdictionCode) {
      const jRows = await db.select({ id: jurisdictions.id }).from(jurisdictions).where(eq(jurisdictions.code, classification.detectedJurisdictionCode)).limit(1);
      detectedJurisdictionId = jRows[0]?.id ?? null;
    }

    // Extraction
    await writeAudit(documentId, userId, "document_extraction_started", { typeCode: classification.documentTypeCode });

    const extractor = classification.documentTypeCode ? getExtractor(classification.documentTypeCode) : null;
    const extractionResult = extractor ? extractor.extract(ocrResult.fullText, taxYear) : null;

    // Créer l'extraction
    const extractionValues = {
      fiscalDocumentId: documentId, userId,
      detectedDocumentTypeId, classificationConfidence: classification.confidence,
      classificationReason: classification.reason, detectedTaxYear: classification.detectedTaxYear,
      detectedJurisdictionId, status: extractionResult ? "completed" as const : "needs_review" as const,
      ocrProvider: ocrResult.provider, overallConfidence: extractionResult?.overallConfidence ?? ocrResult.overallConfidence,
      needsHumanReview: Boolean(extractionResult?.needsHumanReview ?? true) || typeConflict,
      yearMismatchWarning: extractionResult?.yearMismatchWarning ?? false,
      processingStartedAt: new Date(), ocrCompletedAt: new Date(),
      classifiedAt: new Date(), extractedAt: extractionResult ? new Date() : null,
      errorMessage: null,
      updatedAt: new Date(),
    };
    const existingExtraction = await db.select({ id: documentExtractions.id })
      .from(documentExtractions).where(eq(documentExtractions.fiscalDocumentId, documentId)).limit(1);
    let extraction: { id: string };
    if (existingExtraction[0]) {
      await db.delete(extractionFields).where(eq(extractionFields.extractionId, existingExtraction[0].id));
      const [updated] = await db.update(documentExtractions).set(extractionValues)
        .where(eq(documentExtractions.id, existingExtraction[0].id)).returning({ id: documentExtractions.id });
      extraction = updated;
    } else {
      const [created] = await db.insert(documentExtractions).values(extractionValues).returning({ id: documentExtractions.id });
      extraction = created;
    }

    // Persister les champs
    if (extractionResult?.fields.length) {
      for (const field of extractionResult.fields) {
        await db.insert(extractionFields).values({
          extractionId: extraction.id, fieldCode: field.fieldCode, fieldLabel: field.fieldLabel,
          pageNumber: field.pageNumber ?? 1, rawOcrValue: field.rawOcrValue,
          ocrConfidence: field.confidence, needsReview: field.needsReview,
          isRequired: field.isRequired, validationStatus: "unreviewed",
        });
      }
    }

    const finalNeedsReview = Boolean(extractionResult?.needsHumanReview ?? true) || typeConflict;
    const finalStatus = finalNeedsReview ? "needs_review" : "extracted";
    await db.update(fiscalDocuments).set({ status: finalStatus, updatedAt: new Date() }).where(eq(fiscalDocuments.id, documentId));
    await writeAudit(documentId, userId, "document_extraction_completed", { extractionId: extraction.id, fieldsCount: extractionResult?.fields.length ?? 0, confidence: extractionResult?.overallConfidence ?? 0 });

    return {
      status: finalNeedsReview ? "needs_review" : "completed",
      extractionId: extraction.id,
      overallConfidence: extractionResult?.overallConfidence ?? ocrResult.overallConfidence,
      needsHumanReview: finalNeedsReview,
      detectedType: classification.documentTypeCode ?? undefined,
      detectedYear: classification.detectedTaxYear,
      entriesCreated: 0,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erreur inconnue";
    await db.update(fiscalDocuments).set({ status: "processing_failed", updatedAt: new Date() }).where(eq(fiscalDocuments.id, documentId));
    await writeAudit(documentId, userId, "document_ocr_failed", { error: errorMsg });
    return { status: "failed", error: errorMsg };
  }
}
