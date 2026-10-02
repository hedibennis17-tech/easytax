import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jurisdictions } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/jurisdictions — Liste des juridictions canadiennes actives
export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const list = await db
    .select({
      id: jurisdictions.id,
      code: jurisdictions.code,
      nameFr: jurisdictions.nameFr,
      nameEn: jurisdictions.nameEn,
      jurisdictionLevel: jurisdictions.jurisdictionLevel,
      taxAdministration: jurisdictions.taxAdministration,
      hasProvincialReturn: jurisdictions.hasProvincialReturn,
    })
    .from(jurisdictions)
    .where(eq(jurisdictions.isActive, true))
    .orderBy(jurisdictions.code);

  return NextResponse.json({ jurisdictions: list });
}
