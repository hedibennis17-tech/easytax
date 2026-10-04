import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { normalizeProvinceCode } from "@/lib/provinces";

export async function GET() {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const profile = await db
    .select({
      id: taxProfiles.id,
      firstName: taxProfiles.firstName,
      lastName: taxProfiles.lastName,
      dateOfBirth: taxProfiles.dateOfBirth,
      sinLastFour: taxProfiles.sinLastFour,
      sinStatus: taxProfiles.sinStatus,
      sinVerified: taxProfiles.sinVerified,
      phone: taxProfiles.phone,
      email: taxProfiles.email,
      address: taxProfiles.address,
      city: taxProfiles.city,
      province: taxProfiles.province,
      postalCode: taxProfiles.postalCode,
      maritalStatus: taxProfiles.maritalStatus,
      fiscalResidence: taxProfiles.fiscalResidence,
      isCanadianCitizen: taxProfiles.isCanadianCitizen,
      isQuebecResident: taxProfiles.isQuebecResident,
      createdAt: taxProfiles.createdAt,
      updatedAt: taxProfiles.updatedAt,
    })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, ctx.clerkUserId))
    .limit(1);

  if (profile.length === 0) {
    return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
  }

  return NextResponse.json(profile[0]);
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await req.json();
  const province = normalizeProvinceCode(body.province);
  const fiscalResidence = normalizeProvinceCode(body.fiscalResidence) ?? province;
  if (!province || !fiscalResidence) {
    return NextResponse.json({ error: "Province ou territoire invalide." }, { status: 422 });
  }

  const existing = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, ctx.clerkUserId))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: "Un profil existe déjà" }, { status: 409 });
  }

  const [created] = await db
    .insert(taxProfiles)
    .values({
      userId: ctx.clerkUserId, // Toujours depuis la session Clerk
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
      sinLastFour: body.sin ? String(body.sin).slice(-4) : null,
      phone: body.phone,
      email: body.email,
      address: body.address,
      city: body.city,
      province,
      postalCode: body.postalCode,
      maritalStatus: body.maritalStatus,
      fiscalResidence,
      isCanadianCitizen: body.isCanadianCitizen,
      isQuebecResident: fiscalResidence === "QC",
    })
    .returning({ id: taxProfiles.id, firstName: taxProfiles.firstName });

  return NextResponse.json(created, { status: 201 });
}
