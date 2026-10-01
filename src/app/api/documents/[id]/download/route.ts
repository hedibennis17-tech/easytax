import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentAuditLogs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSignedDownloadUrl } from "@/lib/storage";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// GET /api/documents/[id]/download — URL signée 15 minutes
// Jamais d'URL publique permanente pour des documents fiscaux
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  // Vérification ownership stricte
  const doc = await db
    .select({
      id: fiscalDocuments.id,
      storageKey: fiscalDocuments.storageKey,
      originalFilename: fiscalDocuments.originalFilename,
      status: fiscalDocuments.status,
    })
    .from(fiscalDocuments)
    .where(
      and(
        eq(fiscalDocuments.id, id),
        eq(fiscalDocuments.userId, userId), // ownership
        isNull(fiscalDocuments.deletedAt)
      )
    )
    .limit(1);

  if (doc.length === 0) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  if (doc[0].status === "archived") {
    return NextResponse.json(
      { error: "Ce document est archivé" },
      { status: 403 }
    );
  }

  // URL signée temporaire — expire dans 15 minutes
  const signedUrl = await getSignedDownloadUrl(doc[0].storageKey, 900);

  // Audit
  await db.insert(documentAuditLogs).values({
    documentId: doc[0].id,
    userId,
    action: "document_downloaded",
    metadata: JSON.stringify({ documentId: doc[0].id }),
  });

  return NextResponse.json({
    url: signedUrl,
    expiresInSeconds: 900,
    filename: doc[0].originalFilename,
  });
}
