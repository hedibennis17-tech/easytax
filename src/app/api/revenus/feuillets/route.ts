/**
 * GET /api/revenus/feuillets
 * Retourne tous les feuillets du dossier avec leurs cases et valeurs OCR,
 * mappées aux lignes T1/TP-1 via le dictionnaire de segmentation.
 * Utilisé par la section Revenus du questionnaire.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, fiscalDocuments,
  documentExtractions, extractionFields, documentTypes,
} from "@/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";
import { getSlipDict, parseMontantOCR } from "@/lib/ocr/dictionnaire";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ feuillets: [] });

  const [taxReturn] = await db.select({ id: taxReturns.id })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);
  if (!taxReturn) return NextResponse.json({ feuillets: [] });

  const docs = await db.select({
    docId: fiscalDocuments.id,
    typeCode: documentTypes.code,
    nameFr: documentTypes.labelFr,
    status: fiscalDocuments.status,
    extractionId: documentExtractions.id,
    originalFilename: fiscalDocuments.originalFilename,
  }).from(fiscalDocuments)
    .innerJoin(documentExtractions, eq(documentExtractions.fiscalDocumentId, fiscalDocuments.id))
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(and(
      eq(fiscalDocuments.userId, userId),
      eq(fiscalDocuments.taxReturnId, taxReturn.id),
      isNotNull(documentExtractions.extractedAt),
    ));

  const feuillets = await Promise.all(docs.map(async doc => {
    const slipDef = getSlipDict(doc.typeCode ?? "");
    const fields = await db.select({
      code: extractionFields.fieldCode,
      label: extractionFields.fieldLabel,
      rawValue: extractionFields.rawOcrValue,
      validatedValue: extractionFields.validatedValue,
      confidence: extractionFields.ocrConfidence,
    }).from(extractionFields)
      .where(eq(extractionFields.extractionId, doc.extractionId));

    // Mapper chaque case vers sa définition dans le dictionnaire
    const cases = (slipDef?.boxes ?? []).map(boxDef => {
      // Chercher la valeur dans les champs extraits
      const fieldKey = `box_${boxDef.code}`;
      const altKey = `case_${boxDef.code}`;
      const extracted = fields.find(f =>
        f.code === fieldKey || f.code === altKey ||
        f.code === boxDef.code ||
        f.code.toLowerCase() === `box_${boxDef.code.toLowerCase()}`
      );
      const rawVal = extracted?.validatedValue ?? extracted?.rawValue ?? null;
      const amountCents = rawVal ? parseMontantOCR(rawVal) : null;

      return {
        code: boxDef.code,
        label_fr: boxDef.label_fr,
        label_en: boxDef.label_en,
        t1_line: boxDef.t1_line,
        tp1_line: boxDef.tp1_line,
        rawValue: rawVal,
        amountCents,
        amount: amountCents !== null
          ? (amountCents / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) + " $"
          : null,
        confidence: extracted?.confidence ?? 0,
        hasValue: amountCents !== null && amountCents > 0,
        isRequired: boxDef.data_type === "money" && ["14","16","18","22","A","E"].includes(boxDef.code),
        hasCondition: Boolean(boxDef.t1_line_condition),
        includedIn: boxDef.included_in ?? null,
        autoDeductionLine: boxDef.auto_deduction_line ?? null,
        notes: boxDef.notes ?? null,
      };
    });

    return {
      docId: doc.docId,
      typeCode: doc.typeCode ?? "OTHER",
      nameFr: slipDef?.name_fr ?? doc.nameFr ?? doc.typeCode ?? "Document fiscal",
      filename: doc.originalFilename ?? doc.typeCode ?? 'Document',
      status: doc.status,
      cases,
      totalExtracted: cases.filter(c => c.hasValue).length,
      totalCases: cases.length,
    };
  }));

  return NextResponse.json({
    feuillets: feuillets.filter(f => f.typeCode !== "OTHER"),
    totalFeuillets: feuillets.length,
    hasData: feuillets.some(f => f.totalExtracted > 0),
  });
}
