import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documentTypes } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/documents/types — types de documents actifs (public, utilisé pour le formulaire upload)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("x-user-id");
  if (!auth) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

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

  return NextResponse.json({ types });
}
