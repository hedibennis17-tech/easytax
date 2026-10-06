/**
 * GET /api/revenus/feuillet/[id]
 * Retourne les cases OCR d'un document spécifique, mappées via le dictionnaire.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentExtractions, extractionFields, documentTypes, documentPages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSlipDict, parseMontantOCR, extractAllBoxes } from "@/lib/ocr/dictionnaire";
import { getExtractor } from "@/lib/extractors/t4";
import { db as _db } from "@/lib/db";
import { documentPages as docPagesTable } from "@/db/schema";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id: documentId } = await params;

  // Récupérer le document et son type
  const [doc] = await db.select({
    id: fiscalDocuments.id,
    typeCode: documentTypes.code,
    nameFr: documentTypes.labelFr,
    status: fiscalDocuments.status,
  }).from(fiscalDocuments)
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(and(eq(fiscalDocuments.id, documentId), eq(fiscalDocuments.userId, userId)))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  // Récupérer l'extraction et les champs
  const [extraction] = await db.select({ id: documentExtractions.id })
    .from(documentExtractions)
    .where(eq(documentExtractions.fiscalDocumentId, documentId))
    .limit(1);

  const fields = extraction ? await db.select({
    code: extractionFields.fieldCode,
    label: extractionFields.fieldLabel,
    rawValue: extractionFields.rawOcrValue,
    validatedValue: extractionFields.validatedValue,
    confidence: extractionFields.ocrConfidence,
  }).from(extractionFields).where(eq(extractionFields.extractionId, extraction.id)) : [];

  // Mapper les cases via le dictionnaire
  const slipCode = doc.typeCode ?? "T4";
  const slipDef = getSlipDict(slipCode);
  const allBoxes = slipDef?.boxes ?? [];

  // Charger texte OCR depuis documentPages
  const ocrPages = await db.select({ ocrText: documentPages.ocrText })
    .from(documentPages).where(eq(documentPages.documentId, documentId));
  const fullOcrText = ocrPages.map(p => p.ocrText ?? "").join("\n\n");

  // Si typeCode=OTHER ou pas dans le dictionnaire → re-classifier
  let effectiveSlipCode = slipCode;
  if (slipCode === "OTHER" || !slipDef) {
    const { classifySlip } = await import("@/lib/ocr/dictionnaire");
    const detected = classifySlip(fullOcrText);
    if (detected) effectiveSlipCode = detected;
  }

  // Re-charger le slipDef avec le bon code
  const finalSlipDef = getSlipDict(effectiveSlipCode) ?? slipDef;
  const finalAllBoxes = finalSlipDef?.boxes ?? [];

  // Si extractionFields vide → extraire depuis le texte OCR en DB (documentPages)
  let enrichedFields = fields;
  if ((fields.length === 0 || slipCode === "OTHER") && fullOcrText.length > 50) {
    const boxes = extractAllBoxes(fullOcrText, effectiveSlipCode);
    enrichedFields = boxes
      .filter(b => b.rawValue)
      .map(b => ({
        code: `box_${b.code}`,
        label: b.label_fr,
        rawValue: b.rawValue,
        validatedValue: b.rawValue,
        confidence: b.confidence,
      }));
  }

  const cases = finalAllBoxes.map(boxDef => {
    // Chercher la valeur extraite
    const candidates = [`box_${boxDef.code}`, `case_${boxDef.code}`, boxDef.code];
    const extracted = enrichedFields.find(f => candidates.some(c =>
      f.code.toLowerCase() === c.toLowerCase()
    ));
    const rawValue = extracted?.validatedValue ?? extracted?.rawValue ?? null;
    const amountCents = rawValue ? parseMontantOCR(rawValue) : null;
    const conf = extracted?.confidence ?? 0;

    return {
      code: boxDef.code,
      label_fr: boxDef.label_fr,
      label_en: boxDef.label_en ?? null,
      t1_line: boxDef.t1_line,
      tp1_line: boxDef.tp1_line,
      rawValue,
      amountCents,
      amount: amountCents ? (amountCents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) : null,
      confidence: conf ?? 0,
      hasValue: !!rawValue && (amountCents ?? 0) > 0,
      isRequired: boxDef.data_type === "money" && (boxDef.t1_line !== null || boxDef.tp1_line !== null),
      hasCondition: !!boxDef.t1_line_condition,
      autoDeductionLine: boxDef.auto_deduction_line ?? null,
      includedIn: boxDef.included_in ?? null,
      notes: boxDef.notes ?? null,
    };
  });

  return NextResponse.json({
    docId: documentId,
    typeCode: slipCode,
    nameFr: slipDef?.name_fr ?? doc.nameFr ?? slipCode,
    cases,
    totalExtracted: cases.filter(c => c.hasValue && !c.includedIn).length,
    totalCases: cases.filter(c => !c.includedIn).length,
  });
}
