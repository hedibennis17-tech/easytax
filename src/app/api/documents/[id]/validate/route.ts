import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentExtractions, extractionFields, documentAuditLogs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { id } = await params;

  const doc = await db
    .select({ id: fiscalDocuments.id, userId: fiscalDocuments.userId, status: fiscalDocuments.status })
    .from(fiscalDocuments)
    .where(and(eq(fiscalDocuments.id, id), isNull(fiscalDocuments.deletedAt)))
    .limit(1);

  if (!doc[0] || doc[0].userId !== ctx.clerkUserId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const extraction = await db
    .select({ id: documentExtractions.id })
    .from(documentExtractions)
    .where(eq(documentExtractions.fiscalDocumentId, id))
    .limit(1);

  if (!extraction[0]) return NextResponse.json({ error: "Aucune extraction à valider" }, { status: 404 });

  await db.update(extractionFields)
    .set({ validationStatus: "confirmed", updatedAt: new Date() })
    .where(and(eq(extractionFields.extractionId, extraction[0].id), eq(extractionFields.validationStatus, "unreviewed")));

  await db.update(documentExtractions)
    .set({ status: "validated", validatedAt: new Date(), reviewedByUserId: ctx.clerkUserId, reviewedAt: new Date(), needsHumanReview: false, updatedAt: new Date() })
    .where(eq(documentExtractions.id, extraction[0].id));

  await db.update(fiscalDocuments)
    .set({ status: "ready_for_tax_return", updatedAt: new Date() })
    .where(eq(fiscalDocuments.id, id));

  await db.insert(documentAuditLogs).values({
    documentId: id, userId: ctx.clerkUserId, action: "document_extraction_validated",
    metadata: JSON.stringify({ extractionId: extraction[0].id }),
  });

  return NextResponse.json({ message: "Extraction validée. Document prêt pour la déclaration.", status: "ready_for_tax_return" });
}
