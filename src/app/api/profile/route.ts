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

export async function PUT(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await req.json() as Record<string, unknown>;
  const province = normalizeProvinceCode(String(body.province ?? ""));
  const fiscalResidence = normalizeProvinceCode(String(body.taxProvince ?? body.fiscalResidence ?? "")) ?? province;
  if (!province || !fiscalResidence) {
    return NextResponse.json({ error: "Province ou territoire invalide." }, { status: 422 });
  }

  const maritalMap: Record<string, string> = {
    "Célibataire": "single", "Marié(e)": "married", "Conjoint(e) de fait": "common_law",
    "Séparé(e)": "separated", "Divorcé(e)": "divorced", "Veuf ou veuve": "widowed",
  };
  const maritalRaw = String(body.marital ?? "");
  const maritalStatus = (maritalMap[maritalRaw] ?? maritalRaw) as "single"|"married"|"common_law"|"separated"|"divorced"|"widowed"|null;

  const isCanadianCitizen = (() => {
    const s = String(body.canStatus ?? "").toLowerCase();
    if (s.includes("citoyen")) return true;
    if (s.includes("permanent") || s.includes("temporaire") || s.includes("protégée") || s.includes("autre")) return false;
    return null;
  })();

  await db.update(taxProfiles).set({
    firstName: body.firstName ? String(body.firstName) : undefined,
    lastName:  body.lastName  ? String(body.lastName)  : undefined,
    dateOfBirth: body.birthDate ? String(body.birthDate) : undefined,
    sinLastFour: body.nas ? String(body.nas).replace(/\s/g,"").slice(-4) || undefined : undefined,
    phone:    body.phone    ? String(body.phone)    : undefined,
    email:    body.email    ? String(body.email)    : undefined,
    address:  body.address  ? String(body.address)  : undefined,
    city:     body.city     ? String(body.city)     : undefined,
    postalCode: body.postal ? String(body.postal)   : undefined,
    province,
    fiscalResidence,
    isQuebecResident: fiscalResidence === "QC",
    maritalStatus: maritalStatus || undefined,
    isCanadianCitizen: isCanadianCitizen ?? undefined,
    updatedAt: new Date(),
  }).where(eq(taxProfiles.userId, ctx.clerkUserId));

  return NextResponse.json({ updated: true });
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
