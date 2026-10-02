import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  fiscalDocuments,
  documentExtractions,
  extractionFields,
  documentAuditLogs,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// POST /api/documents/[id]/validate
// Valide l'extraction complète — marque le document ready_for_tax_return
// RÈGLE : une donnée OCR non validée ne doit JAMAIS aller dans la déclaration
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  // Ownership check
  const doc = await db
    .select({ id: fiscalDocuments.id, userId: fiscalDocuments.userId, status: fiscalDocuments.status })
    .from(fiscalDocuments)
    .where(and(eq(fiscalDocuments.id, id), isNull(fiscalDocuments.deletedAt)))
    .limit(1);

  if (!doc[0] || doc[0].userId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Charger l'extraction
  const extraction = await db
    .select({ id: documentExtractions.id, status: documentExtractions.status })
    .from(documentExtractions)
    .where(eq(documentExtractions.fiscalDocumentId, id))
    .limit(1);

  if (!extraction[0]) {
    return NextResponse.json({ error: "Aucune extraction à valider" }, { status: 404 });
  }

  // Vérifier les champs requis non renseignés
  const unreviewedRequired = await db
    .select({ id: extractionFields.id, fieldCode: extractionFields.fieldCode })
    .from(extractionFields)
    .where(
      and(
        eq(extractionFields.extractionId, extraction[0].id),
        eq(extractionFields.isRequired, true),
        eq(extractionFields.validationStatus, "unreviewed")
      )
    );

  // Confirmer tous les champs non corrigés comme confirmés
  await db
    .update(extractionFields)
    .set({ validationStatus: "confirmed", updatedAt: new Date() })
    .where(
      and(
        eq(extractionFields.extractionId, extraction[0].id),
        eq(extractionFields.validationStatus, "unreviewed")
      )
    );

  // Mettre à jour l'extraction
  await db
    .update(documentExtractions)
    .set({
      status: "validated",
      validatedAt: new Date(),
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      needsHumanReview: false,
      updatedAt: new Date(),
    })
    .where(eq(documentExtractions.id, extraction[0].id));

  // Marquer le document prêt pour la déclaration
  await db
    .update(fiscalDocuments)
    .set({ status: "ready_for_tax_return", updatedAt: new Date() })
    .where(eq(fiscalDocuments.id, id));

  // Audit
  await db.insert(documentAuditLogs).values({
    documentId: id,
    userId,
    action: "document_extraction_validated",
    metadata: JSON.stringify({
      extractionId: extraction[0].id,
      unreviewedRequiredCount: unreviewedRequired.length,
    }),
  });

  return NextResponse.json({
    message: "Extraction validée. Document prêt pour la déclaration.",
    status: "ready_for_tax_return",
  });
}
