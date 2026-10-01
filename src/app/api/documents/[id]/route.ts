import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentTypes, taxYears, documentAuditLogs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// Vérification d'ownership stricte — User A ne peut jamais accéder au doc de User B
async function getDocumentForUser(documentId: string, userId: string) {
  const docs = await db
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
      storageKey: fiscalDocuments.storageKey, // retourné seulement en interne
      typeCode: documentTypes.code,
      typeLabelFr: documentTypes.labelFr,
      year: taxYears.year,
    })
    .from(fiscalDocuments)
    .innerJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .innerJoin(taxYears, eq(fiscalDocuments.taxYearId, taxYears.id))
    .where(
      and(
        eq(fiscalDocuments.id, documentId),
        eq(fiscalDocuments.userId, userId), // DOUBLE vérification ownership
        isNull(fiscalDocuments.deletedAt)
      )
    )
    .limit(1);

  return docs[0] ?? null;
}

// GET /api/documents/[id] — métadonnées (sans storageKey)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await getDocumentForUser(id, userId);

  if (!doc) {
    // Retourner 404 même si le document existe mais appartient à quelqu'un d'autre
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Audit log — vue du document
  await db.insert(documentAuditLogs).values({
    documentId: doc.id,
    userId,
    action: "document_viewed",
    metadata: JSON.stringify({ documentId: doc.id }),
  });

  // Ne jamais retourner storageKey ou sha256Hash dans la réponse publique
  const { storageKey: _, ...publicDoc } = doc;
  return NextResponse.json(publicDoc);
}
