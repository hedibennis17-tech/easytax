import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentPages, documentExtractions, extractionFields, documentTypes, taxReturns, taxProfiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getExtractor } from "@/lib/extractors/t4";
import { syncOcrToEntries } from "@/lib/ocr-to-entries";
import { classifyTaxDocument } from "@/lib/document-intelligence/catalog";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const url = new URL(req.url);
  const docId = url.searchParams.get("docId");

  const [profile] = await db.select({ id: taxProfiles.id }).from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [tr] = await db.select({ id: taxReturns.id }).from(taxReturns).where(eq(taxReturns.profileId, profile.id)).orderBy(desc(taxReturns.updatedAt)).limit(1);
  if (!tr) return NextResponse.json({ error: "TaxReturn introuvable" }, { status: 404 });

  const allDocs = await db.select({
    id: fiscalDocuments.id, status: fiscalDocuments.status,
    taxReturnId: fiscalDocuments.taxReturnId, typeCode: documentTypes.code,
  }).from(fiscalDocuments)
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(eq(fiscalDocuments.userId, userId));

  const targets = docId
    ? allDocs.filter(d => d.id === docId || d.id.startsWith(docId))
    : allDocs.filter(d => ["needs_review","processing_failed","rejected","extracted"].includes(d.status ?? ""));

  const results = [];

  for (const doc of targets) {
    const pages = await db.select({ ocrText: documentPages.ocrText }).from(documentPages)
      .where(eq(documentPages.documentId, doc.id)).orderBy(documentPages.pageNumber);

    if (!pages[0]?.ocrText) {
      results.push({ docId: doc.id.slice(0,8), status: "skip", reason: "Pas de texte OCR" }); continue;
    }

    const fullText = pages.map(p => p.ocrText ?? "").join("\n\n");
    const classification = classifyTaxDocument(fullText);
    const typeCode = classification.documentTypeCode ?? doc.typeCode ?? "T4";

    if (classification.documentTypeCode && classification.documentTypeCode !== doc.typeCode) {
      const [dt] = await db.select({ id: documentTypes.id }).from(documentTypes).where(eq(documentTypes.code, classification.documentTypeCode)).limit(1);
      if (dt) await db.update(fiscalDocuments).set({ documentTypeId: dt.id, updatedAt: new Date() }).where(eq(fiscalDocuments.id, doc.id));
    }

    const extractor = getExtractor(typeCode);
    if (!extractor) { results.push({ docId: doc.id.slice(0,8), status: "skip", reason: `Pas d'extracteur pour ${typeCode}` }); continue; }

    const extracted = extractor.extract(fullText, 2025);

    const [existingExt] = await db.select({ id: documentExtractions.id }).from(documentExtractions)
      .where(eq(documentExtractions.fiscalDocumentId, doc.id)).limit(1);

    let extractionId: string;
    if (existingExt) {
      await db.delete(extractionFields).where(eq(extractionFields.extractionId, existingExt.id));
      await db.update(documentExtractions).set({
        status: "completed", extractedAt: new Date(), updatedAt: new Date(),
        errorMessage: null, needsHumanReview: extracted.needsHumanReview, overallConfidence: extracted.overallConfidence,
      }).where(eq(documentExtractions.id, existingExt.id));
      extractionId = existingExt.id;
    } else {
      const [c] = await db.insert(documentExtractions).values({
        fiscalDocumentId: doc.id, userId, status: "completed", ocrProvider: "google",
        extractedAt: new Date(), overallConfidence: extracted.overallConfidence,
        needsHumanReview: extracted.needsHumanReview, updatedAt: new Date(),
      }).returning({ id: documentExtractions.id });
      extractionId = c.id;
    }

    for (const field of extracted.fields) {
      await db.insert(extractionFields).values({
        extractionId, fieldCode: field.fieldCode, fieldLabel: field.fieldLabel,
        pageNumber: field.pageNumber ?? 1, rawOcrValue: field.rawOcrValue,
        ocrConfidence: field.confidence, needsReview: field.needsReview,
        isRequired: field.isRequired, validationStatus: "unreviewed",
      });
    }

    const sync = await syncOcrToEntries({
      extractionId, documentId: doc.id, userId,
      taxReturnId: doc.taxReturnId ?? tr.id,
      documentTypeCode: typeCode, ocrText: fullText,
    });

    await db.update(fiscalDocuments).set({ status: "extracted", taxReturnId: doc.taxReturnId ?? tr.id, updatedAt: new Date() }).where(eq(fiscalDocuments.id, doc.id));
    results.push({ docId: doc.id.slice(0,8), status: "ok", typeCode, fields: extracted.fields.length, entries: sync.created, conf: extracted.overallConfidence });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
