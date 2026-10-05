import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { fiscalDocuments, documentAuditLogs } from "@/db/schema";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";

// PATCH /api/documents/[id]/archive — archive ou restaure sans effacer le fichier.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "archive" | "restore" | undefined;
  if (!action || !["archive", "restore"].includes(action)) {
    return NextResponse.json({ error: "Action invalide. Utiliser archive ou restore." }, { status: 400 });
  }

  const [document] = await db.select({ id: fiscalDocuments.id })
    .from(fiscalDocuments)
    .where(and(
      eq(fiscalDocuments.id, id),
      eq(fiscalDocuments.userId, ctx.clerkUserId),
      isNull(fiscalDocuments.deletedAt),
    ))
    .limit(1);
  if (!document) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const isArchive = action === "archive";
  await db.update(fiscalDocuments)
    .set({
      status: isArchive ? "archived" : "stored",
      archivedAt: isArchive ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(fiscalDocuments.id, id), eq(fiscalDocuments.userId, ctx.clerkUserId)));

  await db.insert(documentAuditLogs).values({
    documentId: id,
    userId: ctx.clerkUserId,
    action: isArchive ? "document_archived" : "document_restored",
    metadata: JSON.stringify({ documentId: id }),
  });

  return NextResponse.json({ message: isArchive ? "Document archivé." : "Document restauré." });
}
