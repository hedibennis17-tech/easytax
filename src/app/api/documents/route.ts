import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentTypes, taxYears, taxProfiles } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

function getUserId(req: NextRequest): string | null {
  // TODO étape auth : remplacer par session réelle
  return req.headers.get("x-user-id");
}

// GET /api/documents?yearId=xxx&typeCode=T4&status=stored
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const yearId = searchParams.get("yearId");
  const typeCode = searchParams.get("typeCode");

  // Vérifier que le profil appartient à cet utilisateur
  const profile = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, userId))
    .limit(1);

  if (profile.length === 0) {
    return NextResponse.json({ documents: [] });
  }

  // Construire la requête — toujours filtré par userId ET taxProfileId
  const conditions = [
    eq(fiscalDocuments.userId, userId),
    eq(fiscalDocuments.taxProfileId, profile[0].id),
    isNull(fiscalDocuments.deletedAt), // Ne pas afficher les supprimés
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
      // Type de document
      typeCode: documentTypes.code,
      typeLabelFr: documentTypes.labelFr,
      typeCategory: documentTypes.category,
      // Année fiscale
      year: taxYears.year,
      // JAMAIS : storageKey, storagePath, sha256Hash, userId raw
    })
    .from(fiscalDocuments)
    .innerJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .innerJoin(taxYears, eq(fiscalDocuments.taxYearId, taxYears.id))
    .where(and(...conditions))
    .orderBy(fiscalDocuments.uploadedAt);

  return NextResponse.json({ documents: docs });
}
