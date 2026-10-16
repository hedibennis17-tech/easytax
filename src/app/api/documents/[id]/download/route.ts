import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentAuditLogs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSignedDownloadUrl } from "@/lib/storage";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";

// GET /api/documents/[id]/download — URL signée 15 minutes
// Jamais d'URL publique permanente pour des documents fiscaux
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;

  const doc = await db
    .select({
      id: fiscalDocuments.id,
      storageKey: fiscalDocuments.storageKey,
      originalFilename: fiscalDocuments.originalFilename,
      mimeType: fiscalDocuments.mimeType,
    })
    .from(fiscalDocuments)
    .where(
      and(
        eq(fiscalDocuments.id, id),
        eq(fiscalDocuments.userId, ctx.clerkUserId),
        isNull(fiscalDocuments.deletedAt)
      )
    )
    .limit(1);

  if (doc.length === 0) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // URL signée temporaire — expire dans 15 minutes
  const signedUrl = await getSignedDownloadUrl(doc[0].storageKey, 900);

  // Audit silencieux
  await db.insert(documentAuditLogs).values({
    documentId: doc[0].id,
    userId: ctx.clerkUserId,
    action: "document_downloaded",
    metadata: JSON.stringify({ documentId: doc[0].id }),
  }).catch(() => undefined);

  return NextResponse.json({
    url: signedUrl,
    expiresInSeconds: 900,
    filename: doc[0].originalFilename,
    mimeType: doc[0].mimeType,
  });
}
