import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  fiscalDocuments,
  documentExtractions,
  extractionFields,
  documentTypes,
  jurisdictions,
  documentAuditLogs,
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// GET /api/documents/[id]/extraction — données extraites (jamais NAS ni storageKey)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  // Ownership check
  const doc = await db
    .select({ id: fiscalDocuments.id, userId: fiscalDocuments.userId })
    .from(fiscalDocuments)
    .where(and(eq(fiscalDocuments.id, id), isNull(fiscalDocuments.deletedAt)))
    .limit(1);

  if (!doc[0] || doc[0].userId !== userId) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Charger l'extraction
  const extraction = await db
    .select({
      id: documentExtractions.id,
      status: documentExtractions.status,
      classificationConfidence: documentExtractions.classificationConfidence,
      classificationReason: documentExtractions.classificationReason,
      overallConfidence: documentExtractions.overallConfidence,
      needsHumanReview: documentExtractions.needsHumanReview,
      yearMismatchWarning: documentExtractions.yearMismatchWarning,
      detectedTaxYear: documentExtractions.detectedTaxYear,
      ocrProvider: documentExtractions.ocrProvider,
      extractionVersion: documentExtractions.extractionVersion,
      extractedAt: documentExtractions.extractedAt,
      reviewedAt: documentExtractions.reviewedAt,
      validatedAt: documentExtractions.validatedAt,
      // Type détecté
      detectedTypeCode: documentTypes.code,
      detectedTypeLabelFr: documentTypes.labelFr,
      // Juridiction
      detectedJurisdictionCode: jurisdictions.code,
      detectedJurisdictionNameFr: jurisdictions.nameFr,
    })
    .from(documentExtractions)
    .leftJoin(documentTypes, eq(documentExtractions.detectedDocumentTypeId, documentTypes.id))
    .leftJoin(jurisdictions, eq(documentExtractions.detectedJurisdictionId, jurisdictions.id))
    .where(eq(documentExtractions.fiscalDocumentId, id))
    .limit(1);

  if (!extraction[0]) {
    return NextResponse.json({ error: "Aucune extraction trouvée. Lancez d'abord le traitement." }, { status: 404 });
  }

  // Charger les champs extraits
  const fields = await db
    .select({
      id: extractionFields.id,
      fieldCode: extractionFields.fieldCode,
      fieldLabel: extractionFields.fieldLabel,
      rawOcrValue: extractionFields.rawOcrValue,
      ocrConfidence: extractionFields.ocrConfidence,
      validatedValue: extractionFields.validatedValue,
      validationStatus: extractionFields.validationStatus,
      previousValue: extractionFields.previousValue,
      needsReview: extractionFields.needsReview,
      isRequired: extractionFields.isRequired,
      pageNumber: extractionFields.pageNumber,
      correctedAt: extractionFields.correctedAt,
    })
    .from(extractionFields)
    .where(eq(extractionFields.extractionId, extraction[0].id))
    .orderBy(extractionFields.fieldCode);

  // Audit — vue extraction
  await db.insert(documentAuditLogs).values({
    documentId: id,
    userId,
    action: "document_viewed",
    metadata: JSON.stringify({ context: "extraction_view" }),
  });

  return NextResponse.json({ extraction: extraction[0], fields });
}

// PATCH /api/documents/[id]/extraction — corriger manuellement un champ
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { fieldId, correctedValue, correctionNote } = body;

  if (!fieldId || correctedValue === undefined) {
    return NextResponse.json({ error: "fieldId et correctedValue requis" }, { status: 400 });
  }

  // Ownership check via le document
  const doc = await db
    .select({ userId: fiscalDocuments.userId })
    .from(fiscalDocuments)
    .where(and(eq(fiscalDocuments.id, id), isNull(fiscalDocuments.deletedAt)))
    .limit(1);

  if (!doc[0] || doc[0].userId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Charger le champ actuel pour conserver l'historique
  const field = await db
    .select({ id: extractionFields.id, rawOcrValue: extractionFields.rawOcrValue, validatedValue: extractionFields.validatedValue })
    .from(extractionFields)
    .where(eq(extractionFields.id, fieldId))
    .limit(1);

  if (!field[0]) return NextResponse.json({ error: "Champ introuvable" }, { status: 404 });

  // Sauvegarder la valeur précédente + appliquer la correction
  const previousValue = field[0].validatedValue ?? field[0].rawOcrValue;

  await db
    .update(extractionFields)
    .set({
      validatedValue: correctedValue,
      validationStatus: "corrected",
      previousValue,
      correctedByUserId: userId,
      correctedAt: new Date(),
      correctionNote: correctionNote ?? null,
      needsReview: false,
      updatedAt: new Date(),
    })
    .where(eq(extractionFields.id, fieldId));

  // Audit — jamais la valeur dans les logs
  await db.insert(documentAuditLogs).values({
    documentId: id,
    userId,
    action: "document_extraction_reviewed",
    metadata: JSON.stringify({ fieldId, hadPreviousValue: !!previousValue }),
  });

  return NextResponse.json({ message: "Correction enregistrée." });
}
