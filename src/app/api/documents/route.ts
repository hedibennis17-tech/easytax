import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentTypes, taxYears, taxProfiles, documentExtractions, extractionFields } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(req.url);
  const yearId = searchParams.get("yearId");

  const profile = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, ctx.clerkUserId))
    .limit(1);

  if (profile.length === 0) return NextResponse.json({ documents: [] });

  const conditions = [
    eq(fiscalDocuments.userId, ctx.clerkUserId),
    eq(fiscalDocuments.taxProfileId, profile[0].id),
    isNull(fiscalDocuments.deletedAt),
  ];
  if (yearId) conditions.push(eq(fiscalDocuments.taxYearId, yearId));

  const docs = await db
    .select({
      id: fiscalDocuments.id,
      originalFilename: fiscalDocuments.originalFilename,
      mimeType: fiscalDocuments.mimeType,
      fileSizeBytes: fiscalDocuments.fileSizeBytes,
      status: fiscalDocuments.status,
      source: fiscalDocuments.source,
      pageCount: fiscalDocuments.pageCount,
      uploadedAt: fiscalDocuments.uploadedAt,
      archivedAt: fiscalDocuments.archivedAt,
      typeCode: documentTypes.code,
      typeLabelFr: documentTypes.labelFr,
      typeCategory: documentTypes.category,
      year: taxYears.year,
    })
    .from(fiscalDocuments)
    .innerJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .innerJoin(taxYears, eq(fiscalDocuments.taxYearId, taxYears.id))
    .where(and(...conditions))
    .orderBy(fiscalDocuments.uploadedAt);

  if (docs.length === 0) return NextResponse.json({ documents: [] });

  // Récupérer le nom du payeur (employer_name) pour chaque document via documentExtractions → extractionFields
  const docIds = docs.map(d => d.id);

  const extractions = await db
    .select({ id: documentExtractions.id, fiscalDocumentId: documentExtractions.fiscalDocumentId })
    .from(documentExtractions)
    .where(inArray(documentExtractions.fiscalDocumentId, docIds));

  const payerByDocId: Record<string, string> = {};

  if (extractions.length > 0) {
    const extractionIds = extractions.map(e => e.id);
    const payerFields = await db
      .select({ extractionId: extractionFields.extractionId, rawOcrValue: extractionFields.rawOcrValue, validatedValue: extractionFields.validatedValue })
      .from(extractionFields)
      .where(and(
        inArray(extractionFields.extractionId, extractionIds),
        eq(extractionFields.fieldCode, "employer_name"),
      ));

    // Map extractionId → fiscalDocumentId
    const extractionToDoc: Record<string, string> = {};
    for (const ex of extractions) extractionToDoc[ex.id] = ex.fiscalDocumentId;

    for (const f of payerFields) {
      const docId = extractionToDoc[f.extractionId];
      if (docId) payerByDocId[docId] = f.validatedValue ?? f.rawOcrValue ?? "";
    }
  }

  const docsWithPayer = docs.map(d => ({
    ...d,
    payerName: payerByDocId[d.id] ?? null,
  }));

  return NextResponse.json({ documents: docsWithPayer });
}
