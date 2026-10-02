import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentTypes, taxYears, taxProfiles } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(req.url);
  const yearId = searchParams.get("yearId");
  const typeCode = searchParams.get("typeCode");

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

  return NextResponse.json({ documents: docs });
}
