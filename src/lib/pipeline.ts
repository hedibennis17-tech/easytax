import { db } from "@/lib/db";
import {
  fiscalDocuments, documentPages, documentExtractions,
  extractionFields, documentAuditLogs, documentTypes, jurisdictions,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getOcrProvider } from "@/lib/ocr/provider";
import { getExtractor } from "@/lib/extractors/t4";
import { extractVisibleUnknownFields } from "@/lib/extractors/generic";
import {
  classifyTaxDocument,
  classifyTaxDocumentAs,
  guardSelectedDocumentType,
  DOCUMENT_CATALOG_VERSION,
} from "@/lib/document-intelligence/catalog";
import { ensureCatalogDocumentType } from "@/lib/document-intelligence/catalog-db";
import { s3 } from "@/lib/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export type PipelineStatus = "started" | "ocr_completed" | "classified" | "extracted" | "needs_review" | "completed" | "rejected" | "failed";

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
    // L'audit n'interrompt jamais le traitement fiscal du document.
    console.warn("[ocr] Audit log skipped", { action, error: error instanceof Error ? error.message : String(error) });
  }
}

export async function runOcrPipeline(params: { documentId: string; userId: string; taxYear?: number; selectedTypeCode?: string }): Promise<PipelineResult> {
  const { documentId, userId, taxYear, selectedTypeCode } = params;
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
  await writeAudit(documentId, userId, "document_ocr_started", { mimeType: doc.mimeType, catalogVersion: DOCUMENT_CATALOG_VERSION });

  try {
    const s3Response = await s3.send(new GetObjectCommand({
      Bucket: process.env.NEON_STORAGE_BUCKET ?? "uploads",
      Key: doc.storageKey,
    }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of s3Response.Body as AsyncIterable<Uint8Array>) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const ocrProvider = await getOcrProvider();
    const ocrResult = await ocrProvider.processDocument({ buffer, mimeType: doc.mimeType, documentId });

    for (const page of ocrResult.pages) {
      const existing = await db.select({ id: documentPages.id })
        .from(documentPages)
        .where(and(
          eq(documentPages.documentId, documentId),
          eq(documentPages.pageNumber, page.pageNumber),
        ))
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
        await db.update(documentPages).set({
          ocrStatus: page.error ? "failed" : "completed",
          ocrText: page.text,
          ocrConfidence: page.confidence,
          ocrCompletedAt: new Date(),
          ocrError: page.error ?? null,
        }).where(eq(documentPages.id, existing[0].id));
      }
    }

    await writeAudit(documentId, userId, "document_ocr_completed", {
      provider: ocrResult.provider,
      pageCount: ocrResult.pages.length,
      pagesWithText: ocrResult.pages.filter(page => Boolean(page.text.trim())).length,
      textLength: ocrResult.fullText.length,
      confidence: ocrResult.overallConfidence,
    });

    const effectiveSelectedTypeCode = selectedTypeCode ?? uploadedTypeCode;
    const selectionProof = effectiveSelectedTypeCode && effectiveSelectedTypeCode !== "AUTO" && effectiveSelectedTypeCode !== "OTHER"
      ? classifyTaxDocumentAs(ocrResult.fullText, effectiveSelectedTypeCode)
      : null;
    const classification = selectionProof?.state === "confirmed"
      ? selectionProof
      : classifyTaxDocument(ocrResult.fullText);
    const guard = guardSelectedDocumentType(effectiveSelectedTypeCode, classification);
    await writeAudit(documentId, userId, "document_classified", {
      catalogVersion: DOCUMENT_CATALOG_VERSION,
      uploadedTypeCode: uploadedTypeCode ?? null,
      effectiveSelectedTypeCode: effectiveSelectedTypeCode ?? null,
      detectedTypeCode: classification.documentTypeCode,
      classificationState: classification.state,
      confidence: classification.confidence,
      action: guard.action,
      suggestedTypeCode: guard.suggestedTypeCode,
    });

    const detectedDocumentTypeId = classification.documentTypeCode
      ? await ensureCatalogDocumentType(classification.documentTypeCode)
      : null;
    let detectedJurisdictionId: string | null = null;
    if (classification.detectedJurisdictionCode) {
      const [jurisdiction] = await db.select({ id: jurisdictions.id })
        .from(jurisdictions)
        .where(eq(jurisdictions.code, classification.detectedJurisdictionCode))
        .limit(1);
      detectedJurisdictionId = jurisdiction?.id ?? null;
    }

    await writeAudit(documentId, userId, "document_extraction_started", {
      typeCode: classification.documentTypeCode,
      allowed: guard.accepted,
    });

    const extractor = guard.accepted && classification.documentTypeCode
      ? getExtractor(classification.documentTypeCode)
      : null;
    const extractionResult = !guard.accepted
      ? null
      : extractor
        ? extractor.extract(ocrResult.fullText, taxYear)
        : classification.documentTypeCode
          ? extractVisibleUnknownFields(ocrResult.fullText, taxYear)
          : null;

    const policyMessage = !guard.accepted
      ? `${guard.reason} ${classification.reason}`
      : !extractor
        ? `Le catalogue a identifié ${classification.documentTypeCode}. Les champs visibles sont conservés pour révision, mais aucun mapping fiscal n’est encore activé pour ce type.`
        : null;
    const needsHumanReview = !guard.accepted || Boolean(extractionResult?.needsHumanReview ?? true);
    const extractionValues = {
      fiscalDocumentId: documentId,
      userId,
      detectedDocumentTypeId,
      classificationConfidence: classification.confidence,
      classificationReason: `${classification.reason} ${guard.reason}`,
      detectedTaxYear: classification.detectedTaxYear,
      detectedJurisdictionId,
      status: extractionResult ? "completed" as const : "needs_review" as const,
      ocrProvider: ocrResult.provider,
      overallConfidence: extractionResult?.overallConfidence ?? ocrResult.overallConfidence,
      needsHumanReview,
      yearMismatchWarning: extractionResult?.yearMismatchWarning ?? false,
      processingStartedAt: new Date(),
      ocrCompletedAt: new Date(),
      classifiedAt: new Date(),
      extractedAt: extractionResult ? new Date() : null,
      errorMessage: policyMessage,
      updatedAt: new Date(),
    };

    const [existingExtraction] = await db.select({ id: documentExtractions.id })
      .from(documentExtractions)
      .where(eq(documentExtractions.fiscalDocumentId, documentId))
      .limit(1);
    let extraction: { id: string };
    if (existingExtraction) {
      await db.delete(extractionFields).where(eq(extractionFields.extractionId, existingExtraction.id));
      const [updated] = await db.update(documentExtractions).set(extractionValues)
        .where(eq(documentExtractions.id, existingExtraction.id))
        .returning({ id: documentExtractions.id });
      extraction = updated;
    } else {
      const [created] = await db.insert(documentExtractions).values(extractionValues)
        .returning({ id: documentExtractions.id });
      extraction = created;
    }

    for (const field of extractionResult?.fields ?? []) {
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

    const finalDocumentStatus = !guard.accepted ? "rejected" : needsHumanReview ? "needs_review" : "extracted";
    await db.update(fiscalDocuments).set({ status: finalDocumentStatus, updatedAt: new Date() })
      .where(eq(fiscalDocuments.id, documentId));
    await writeAudit(documentId, userId, "document_extraction_completed", {
      extractionId: extraction.id,
      fieldsCount: extractionResult?.fields.length ?? 0,
      confidence: extractionResult?.overallConfidence ?? 0,
      finalDocumentStatus,
      mappingEnabled: Boolean(extractor),
    });

    return {
      status: !guard.accepted ? "rejected" : needsHumanReview ? "needs_review" : "completed",
      extractionId: extraction.id,
      overallConfidence: extractionResult?.overallConfidence ?? ocrResult.overallConfidence,
      needsHumanReview,
      detectedType: classification.documentTypeCode ?? undefined,
      detectedYear: classification.detectedTaxYear,
      entriesCreated: 0,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Erreur inconnue";
    await db.update(fiscalDocuments).set({ status: "processing_failed", updatedAt: new Date() })
      .where(eq(fiscalDocuments.id, documentId));
    await writeAudit(documentId, userId, "document_ocr_failed", { error: errorMsg });
    return { status: "failed", error: errorMsg };
  }
}
