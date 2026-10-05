import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documentTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { ensureCatalogDocumentTypes } from "@/lib/document-intelligence/catalog-db";

// GET /api/documents/types — les 48 classes fiscales sont synchronisées avant lecture.
export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  await ensureCatalogDocumentTypes();
  const types = await db
    .select({
      id: documentTypes.id,
      code: documentTypes.code,
      labelFr: documentTypes.labelFr,
      labelEn: documentTypes.labelEn,
      category: documentTypes.category,
      isFederal: documentTypes.isFederal,
      isQuebec: documentTypes.isQuebec,
    })
    .from(documentTypes)
    .where(eq(documentTypes.isActive, true))
    .orderBy(documentTypes.sortOrder);

  return NextResponse.json({
    types: [
      {
        id: "AUTO",
        code: "AUTO",
        labelFr: "Détection automatique — laisser EasyTax reconnaître le feuillet",
        labelEn: "Automatic detection — let EasyTax identify the slip",
        category: "smart",
        isFederal: true,
        isQuebec: true,
      },
      ...types,
    ],
  });
}
