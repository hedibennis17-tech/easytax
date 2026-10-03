import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, taxYears, users } from "@/db/schema";
import { eq } from "drizzle-orm";

type ProvinceCode = "QC"|"ON"|"BC"|"AB"|"SK"|"MB"|"NB"|"NS"|"PE"|"NL"|"NT"|"NU"|"YT";

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json() as {
    type: "INDIVIDUAL" | "BUSINESS";
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    province?: string;
    bizProvince?: string;
    phone?: string;
    legalName?: string;
    tradeName?: string;
  };

  // 1. Vérifier user EasyTax
  const existing = await db.select({ id: users.id })
    .from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  if (!existing[0]) return NextResponse.json({ error: "User introuvable" }, { status: 404 });

  // 2. Profil déjà existant → retourner l'existant sans doublon
  const existingProfile = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (existingProfile[0]) {
    return NextResponse.json({ profileId: existingProfile[0].id, existing: true });
  }

  // 3. Année fiscale 2025
  const years = await db.select({ id: taxYears.id })
    .from(taxYears).where(eq(taxYears.year, 2025)).limit(1);

  const province = (body.type === "INDIVIDUAL"
    ? body.province
    : body.bizProvince) as ProvinceCode | undefined ?? "QC";

  // 4. Créer le profil fiscal
  const [created] = await db.insert(taxProfiles).values({
    userId:           clerkUserId,
    firstName:        body.type === "INDIVIDUAL" ? (body.firstName ?? "") : (body.legalName ?? ""),
    lastName:         body.type === "INDIVIDUAL" ? (body.lastName  ?? "") : (body.tradeName ?? ""),
    dateOfBirth:      (body.type === "INDIVIDUAL" && body.dateOfBirth) ? body.dateOfBirth : null,
    phone:            body.type === "INDIVIDUAL" ? (body.phone ?? null) : null,
    province:         province,
    fiscalResidence:  province,
    isQuebecResident: province === "QC",
  }).returning({ id: taxProfiles.id });

  // 5. Mettre à jour le rôle du user si BUSINESS
  if (body.type === "BUSINESS") {
    await db.update(users)
      .set({ role: "BUSINESS", updatedAt: new Date() })
      .where(eq(users.clerkUserId, clerkUserId));
  }

  return NextResponse.json({ profileId: created.id, created: true });
}
