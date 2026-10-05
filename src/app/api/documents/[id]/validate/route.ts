import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentExtractions, extractionFields, documentAuditLogs, documentTypes, documentPages } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { syncOcrToEntries } from "@/lib/ocr-to-entries";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;

  const doc = await db
    .select({
      id: fiscalDocuments.id,
      userId: fiscalDocuments.userId,
      status: fiscalDocuments.status,
      taxReturnId: fiscalDocuments.taxReturnId,
      uploadedDocumentTypeId: fiscalDocuments.documentTypeId,
    })
    .from(fiscalDocuments)
    .where(and(eq(fiscalDocuments.id, id), isNull(fiscalDocuments.deletedAt)))
    .limit(1);

  if (!doc[0] || doc[0].userId !== ctx.clerkUserId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const extraction = await db
    .select({ id: documentExtractions.id, detectedDocumentTypeId: documentExtractions.detectedDocumentTypeId })
    .from(documentExtractions)
    .where(eq(documentExtractions.fiscalDocumentId, id))
    .limit(1);

  if (!extraction[0]) return NextResponse.json({ error: "Aucune extraction à valider" }, { status: 404 });

  const pendingFields = await db.select({ id: extractionFields.id })
    .from(extractionFields)
    .where(and(eq(extractionFields.extractionId, extraction[0].id), eq(extractionFields.validationStatus, "unreviewed")));
  if (pendingFields.length > 0) {
    return NextResponse.json({ error: "Tous les champs OCR doivent être confirmés ou corrigés avant validation." }, { status: 409 });
  }

  await db.update(documentExtractions)
    .set({ status: "validated", validatedAt: new Date(), reviewedByUserId: ctx.clerkUserId, reviewedAt: new Date(), needsHumanReview: false, updatedAt: new Date() })
    .where(eq(documentExtractions.id, extraction[0].id));

  await db.update(fiscalDocuments)
    .set({ status: "ready_for_tax_return", updatedAt: new Date() })
    .where(eq(fiscalDocuments.id, id));

  const effectiveDocumentTypeId = extraction[0].detectedDocumentTypeId ?? doc[0].uploadedDocumentTypeId;
  const [effectiveDocumentType] = effectiveDocumentTypeId
    ? await db.select({ code: documentTypes.code }).from(documentTypes).where(eq(documentTypes.id, effectiveDocumentTypeId)).limit(1)
    : [];
  let entriesCreated = 0;
  if (doc[0].taxReturnId && effectiveDocumentType?.code) {
    const [page] = await db.select({ ocrText: documentPages.ocrText })
      .from(documentPages).where(eq(documentPages.documentId, id)).limit(1);
    const synced = await syncOcrToEntries({
      extractionId: extraction[0].id,
      documentId: id,
      userId: ctx.clerkUserId,
      taxReturnId: doc[0].taxReturnId,
      documentTypeCode: effectiveDocumentType.code,
      ocrText: page?.ocrText ?? undefined,
    });
    entriesCreated = synced.created;
  }

  await db.insert(documentAuditLogs).values({
    documentId: id, userId: ctx.clerkUserId, action: "document_extraction_validated",
    metadata: JSON.stringify({ extractionId: extraction[0].id }),
  });

  return NextResponse.json({ message: "Extraction validée. Document prêt pour la déclaration.", status: "ready_for_tax_return", entriesCreated });
}
