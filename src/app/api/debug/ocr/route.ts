import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  documentAuditLogs,
  documentExtractions,
  documentPages,
  extractionFields,
  fiscalDocuments,
} from "@/db/schema";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { s3 } from "@/lib/storage";

export const runtime = "nodejs";

type ErrorDetails = { code: string | number | null; message: string };

function redactError(error: unknown): ErrorDetails {
  const details = error as { code?: unknown; message?: unknown };
  const raw = error instanceof Error
    ? error.message
    : typeof details?.message === "string"
      ? details.message
      : String(error ?? "Erreur inconnue");

  return {
    code: typeof details?.code === "number" || typeof details?.code === "string" ? details.code : null,
    message: raw
      .replace(/-----BEGIN[\s\S]*?END [A-Z ]+-----/g, "[secret supprimé]")
      .replace(/"private_key"\s*:\s*"[^\"]+"/g, '"private_key":"[secret supprimé]"')
      .slice(0, 700),
  };
}

function googleConfiguration() {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  let credentialsJsonValid = false;
  let serviceAccountConfigured = false;

  if (credentialsJson) {
    try {
      const credentials = JSON.parse(credentialsJson) as { type?: string; client_email?: string };
      credentialsJsonValid = true;
      serviceAccountConfigured = credentials.type === "service_account" && Boolean(credentials.client_email);
    } catch {
      // Le diagnostic signale seulement la validité du JSON, jamais son contenu.
    }
  }

  return {
    provider: process.env.OCR_PROVIDER ?? "mock",
    projectIdConfigured: Boolean(process.env.GOOGLE_CLOUD_PROJECT_ID),
    processorIdConfigured: Boolean(process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID),
    location: process.env.GOOGLE_DOCUMENT_AI_LOCATION ?? "us",
    credentialsJsonConfigured: Boolean(credentialsJson),
    credentialsJsonValid,
    serviceAccountConfigured,
  };
}

async function probeGoogleDocumentAi() {
  const config = googleConfiguration();
  if (config.provider !== "google") {
    return { status: "not_selected", message: "OCR_PROVIDER doit être défini sur google." };
  }
  if (!config.projectIdConfigured || !config.processorIdConfigured || !config.credentialsJsonValid) {
    return { status: "not_configured", message: "La configuration Google Document AI est incomplète ou invalide." };
  }

  try {
    // Chargement tardif : évite tout impact sur les routes qui n'utilisent pas l'OCR.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DocumentProcessorServiceClient } = require("@google-cloud/documentai") as {
      DocumentProcessorServiceClient: new (options: Record<string, unknown>) => {
        getProcessor: (request: { name: string }) => Promise<Array<{ type?: string; state?: string }>>;
      };
    };
    const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION ?? "us";
    const apiEndpoint = location === "us" || location === "eu" ? `${location}-documentai.googleapis.com` : undefined;
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ?? "{}") as Record<string, unknown>;
    const client = new DocumentProcessorServiceClient({ credentials, ...(apiEndpoint ? { apiEndpoint } : {}) });
    const processorName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/${location}/processors/${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`;
    const [processor] = await client.getProcessor({ name: processorName });

    return {
      status: "ready",
      endpoint: apiEndpoint ?? "default",
      processorType: processor?.type ?? null,
      processorState: processor?.state ?? null,
      message: "Google Document AI accepte les identifiants et reconnaît le processeur.",
    };
  } catch (error) {
    const detail = redactError(error);
    const billingOrPermission = detail.code === 7 || /billing|permission_denied|permission denied/i.test(detail.message);
    return {
      status: billingOrPermission ? "billing_or_permission_error" : "connection_error",
      ...detail,
      message: detail.message,
    };
  }
}

async function getDocumentDiagnostic(clerkUserId: string, requestedId: string | null) {
  const where = requestedId
    ? and(eq(fiscalDocuments.id, requestedId), eq(fiscalDocuments.userId, clerkUserId), isNull(fiscalDocuments.deletedAt))
    : and(eq(fiscalDocuments.userId, clerkUserId), isNull(fiscalDocuments.deletedAt));

  const documents = await db
    .select({
      id: fiscalDocuments.id,
      status: fiscalDocuments.status,
      mimeType: fiscalDocuments.mimeType,
      fileSizeBytes: fiscalDocuments.fileSizeBytes,
      storageKey: fiscalDocuments.storageKey,
      uploadedAt: fiscalDocuments.uploadedAt,
      updatedAt: fiscalDocuments.updatedAt,
    })
    .from(fiscalDocuments)
    .where(where)
    .orderBy(desc(fiscalDocuments.uploadedAt))
    .limit(1);

  const document = documents[0];
  if (!document) {
    return { status: "no_document", message: "Aucun document personnel correspondant n’a été trouvé." };
  }

  const [pages, extraction, fields, auditRows] = await Promise.all([
    db.select({
      status: documentPages.ocrStatus,
      confidence: documentPages.ocrConfidence,
      hasText: documentPages.ocrText,
      error: documentPages.ocrError,
    }).from(documentPages).where(eq(documentPages.documentId, document.id)),
    db.select({
      id: documentExtractions.id,
      status: documentExtractions.status,
      provider: documentExtractions.ocrProvider,
      confidence: documentExtractions.overallConfidence,
      extractedAt: documentExtractions.extractedAt,
      error: documentExtractions.errorMessage,
    }).from(documentExtractions).where(eq(documentExtractions.fiscalDocumentId, document.id)).limit(1),
    db.select({
      status: extractionFields.validationStatus,
      hasRawValue: extractionFields.rawOcrValue,
      confidence: extractionFields.ocrConfidence,
    }).from(extractionFields)
      .innerJoin(documentExtractions, eq(extractionFields.extractionId, documentExtractions.id))
      .where(eq(documentExtractions.fiscalDocumentId, document.id)),
    db.select({
      action: documentAuditLogs.action,
      metadata: documentAuditLogs.metadata,
      createdAt: documentAuditLogs.createdAt,
    }).from(documentAuditLogs)
      .where(and(eq(documentAuditLogs.documentId, document.id), eq(documentAuditLogs.userId, clerkUserId)))
      .orderBy(desc(documentAuditLogs.createdAt))
      .limit(12),
  ]);

  let storage: Record<string, unknown>;
  try {
    const response = await s3.send(new HeadObjectCommand({
      Bucket: process.env.NEON_STORAGE_BUCKET ?? "uploads",
      Key: document.storageKey,
    }));
    storage = {
      status: "available",
      byteSizeMatchesUpload: response.ContentLength === document.fileSizeBytes,
      contentTypeMatchesUpload: !response.ContentType || response.ContentType === document.mimeType,
    };
  } catch (error) {
    storage = { status: "unavailable", error: redactError(error) };
  }

  const latestFailure = auditRows.find(row => row.action === "document_ocr_failed" || row.action === "document_extraction_failed");
  let lastFailure: ErrorDetails | null = null;
  if (latestFailure?.metadata) {
    try {
      const metadata = JSON.parse(latestFailure.metadata) as { error?: unknown };
      if (metadata.error) lastFailure = redactError(metadata.error);
    } catch {
      lastFailure = { code: null, message: "Le journal d’erreur OCR est illisible." };
    }
  }

  return {
    status: "document_found",
    document: {
      id: document.id,
      workflowStatus: document.status,
      mimeType: document.mimeType,
      uploadedAt: document.uploadedAt,
      updatedAt: document.updatedAt,
    },
    storage,
    pages: {
      count: pages.length,
      completed: pages.filter(page => page.status === "completed").length,
      failed: pages.filter(page => page.status === "failed").length,
      textDetected: pages.filter(page => Boolean(page.hasText?.trim())).length,
      lastError: pages.find(page => page.error)?.error ? redactError(pages.find(page => page.error)?.error) : null,
    },
    extraction: extraction[0]
      ? {
          status: extraction[0].status,
          provider: extraction[0].provider,
          confidence: extraction[0].confidence,
          extractedAt: extraction[0].extractedAt,
          error: extraction[0].error ? redactError(extraction[0].error) : null,
        }
      : null,
    fields: {
      total: fields.length,
      withValue: fields.filter(field => Boolean(field.hasRawValue?.trim())).length,
      reviewed: fields.filter(field => field.status !== "unreviewed").length,
      averageConfidence: fields.length
        ? Math.round(fields.reduce((total, field) => total + (field.confidence ?? 0), 0) / fields.length)
        : null,
    },
    lastFailure,
    auditTrail: auditRows.map(row => ({ action: row.action, createdAt: row.createdAt })),
  };
}

export async function GET(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  try {
    const documentId = request.nextUrl.searchParams.get("documentId");
    const diagnostic = await getDocumentDiagnostic(ctx.clerkUserId, documentId);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      google: googleConfiguration(),
      diagnostic,
      nextStep: "Envoyez uniquement les états et les messages d’erreur au support. Ne partagez pas les valeurs de champs ni les variables d’environnement.",
    });
  } catch (error) {
    return NextResponse.json({ error: "Le diagnostic OCR n’a pas pu être généré.", detail: redactError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  try {
    const body = await request.json().catch(() => ({})) as { documentId?: string; probeGoogle?: boolean };
    const diagnostic = await getDocumentDiagnostic(ctx.clerkUserId, body.documentId ?? null);
    const google = body.probeGoogle ? await probeGoogleDocumentAi() : googleConfiguration();
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      google,
      diagnostic,
      nextStep: body.probeGoogle
        ? "La sonde vérifie l’accès au processeur sans analyser ni transmettre de document."
        : "Ajoutez probeGoogle:true pour vérifier l’accès au processeur Document AI.",
    });
  } catch (error) {
    return NextResponse.json({ error: "La sonde OCR n’a pas pu être exécutée.", detail: redactError(error) }, { status: 500 });
  }
}
