import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { deleteFromStorage } from "@/lib/storage";
import {
  creditEntries,
  deductionEntries,
  documentAuditLogs,
  documentExtractions,
  documentPages,
  documentParties,
  documentTypes,
  extractionFields,
  fiscalDocuments,
  incomeEntries,
  taxYears,
} from "@/db/schema";

async function getDocumentForUser(documentId: string, userId: string) {
  const [document] = await db
    .select({
      id: fiscalDocuments.id,
      originalFilename: fiscalDocuments.originalFilename,
      mimeType: fiscalDocuments.mimeType,
      fileSizeBytes: fiscalDocuments.fileSizeBytes,
      status: fiscalDocuments.status,
      source: fiscalDocuments.source,
      pageCount: fiscalDocuments.pageCount,
      uploadedAt: fiscalDocuments.uploadedAt,
      archivedAt: fiscalDocuments.archivedAt,
      storageKey: fiscalDocuments.storageKey,
      typeCode: documentTypes.code,
      typeLabelFr: documentTypes.labelFr,
      year: taxYears.year,
    })
    .from(fiscalDocuments)
    .innerJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .innerJoin(taxYears, eq(fiscalDocuments.taxYearId, taxYears.id))
    .where(and(
      eq(fiscalDocuments.id, documentId),
      eq(fiscalDocuments.userId, userId),
      isNull(fiscalDocuments.deletedAt),
    ))
    .limit(1);
  return document ?? null;
}

// GET /api/documents/[id] — métadonnées publiques du document appartenant à la session.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const document = await getDocumentForUser(id, ctx.clerkUserId);
  if (!document) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  // L’audit de consultation ne doit jamais empêcher l’ouverture du document.
  await db.insert(documentAuditLogs).values({
    documentId: document.id,
    userId: ctx.clerkUserId,
    action: "document_viewed",
    metadata: JSON.stringify({ documentId: document.id }),
  }).catch(() => undefined);

  const { storageKey: _storageKey, ...publicDocument } = document;
  return NextResponse.json(publicDocument);
}

/**
 * DELETE /api/documents/[id]
 * Action irréversible, seulement après confirmation explicite dans l’interface.
 * Efface l’objet de stockage, les résultats OCR, les écritures fiscales issues de
 * ce document et le document lui-même. Aucune donnée d’un autre utilisateur n’est
 * sélectionnée ou supprimée.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await req.json().catch(() => ({}));
  if (body.confirmation !== "DELETE_PERMANENTLY") {
    return NextResponse.json(
      { error: "Confirmation explicite requise pour supprimer définitivement ce document." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const document = await getDocumentForUser(id, ctx.clerkUserId);
  if (!document) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const pages = await db.select({ storageKey: documentPages.storageKey })
    .from(documentPages)
    .where(eq(documentPages.documentId, document.id));
  const storageKeys = [document.storageKey, ...pages.map(page => page.storageKey).filter((key): key is string => Boolean(key))];

  try {
    await Promise.all(storageKeys.map(storageKey => deleteFromStorage(storageKey)));
  } catch (error) {
    console.error("[documents/delete] storage deletion failed", error);
    return NextResponse.json(
      { error: "Le fichier n’a pas pu être supprimé du stockage; aucune donnée n’a été retirée." },
      { status: 502 },
    );
  }

  await db.transaction(async (tx) => {
    const extractions = await tx.select({ id: documentExtractions.id })
      .from(documentExtractions)
      .where(eq(documentExtractions.fiscalDocumentId, document.id));
    const extractionIds = extractions.map(extraction => extraction.id);

    if (extractionIds.length > 0) {
      await tx.delete(extractionFields).where(inArray(extractionFields.extractionId, extractionIds));
    }
    await tx.delete(documentExtractions).where(eq(documentExtractions.fiscalDocumentId, document.id));
    await tx.delete(documentPages).where(eq(documentPages.documentId, document.id));
    await tx.delete(documentParties).where(eq(documentParties.fiscalDocumentId, document.id));

    // Les montants qui provenaient uniquement de ce feuillet disparaissent aussi
    // du calcul; le prochain calcul repart donc de la réalité actuelle.
    await tx.delete(incomeEntries).where(eq(incomeEntries.sourceDocumentId, document.id));
    await tx.delete(deductionEntries).where(eq(deductionEntries.sourceDocumentId, document.id));
    await tx.delete(creditEntries).where(eq(creditEntries.sourceDocumentId, document.id));
    await tx.delete(documentAuditLogs).where(eq(documentAuditLogs.documentId, document.id));
    await tx.delete(fiscalDocuments).where(and(
      eq(fiscalDocuments.id, document.id),
      eq(fiscalDocuments.userId, ctx.clerkUserId),
    ));
  });

  return NextResponse.json({ message: "Document, OCR et données associées supprimés définitivement." });
}
