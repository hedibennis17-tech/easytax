import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentAuditLogs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// PATCH /api/documents/[id]/archive — suppression douce (archive, jamais de delete immédiat)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "archive" | "restore" | undefined;

  if (!action || !["archive", "restore"].includes(action)) {
    return NextResponse.json(
      { error: "Action invalide. Utiliser 'archive' ou 'restore'." },
      { status: 400 }
    );
  }

  // Ownership check
  const doc = await db
    .select({ id: fiscalDocuments.id, status: fiscalDocuments.status })
    .from(fiscalDocuments)
    .where(
      and(
        eq(fiscalDocuments.id, id),
        eq(fiscalDocuments.userId, userId),
        isNull(fiscalDocuments.deletedAt)
      )
    )
    .limit(1);

  if (doc.length === 0) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  if (action === "archive") {
    await db
      .update(fiscalDocuments)
      .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(fiscalDocuments.id, id));

    await db.insert(documentAuditLogs).values({
      documentId: id,
      userId,
      action: "document_archived",
      metadata: JSON.stringify({ documentId: id }),
    });

    return NextResponse.json({ message: "Document archivé." });
  }

  // Restore
  await db
    .update(fiscalDocuments)
    .set({ status: "stored", archivedAt: null, updatedAt: new Date() })
    .where(eq(fiscalDocuments.id, id));

  await db.insert(documentAuditLogs).values({
    documentId: id,
    userId,
    action: "document_restored",
    metadata: JSON.stringify({ documentId: id }),
  });

  return NextResponse.json({ message: "Document restauré." });
}
