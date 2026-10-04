import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, taxYears, users, organizations, organizationMemberships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizeProvinceCode } from "@/lib/provinces";

function safeMetadata(input: Record<string, unknown>) {
  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
    if (!value || typeof value !== "object") return value;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (["nas", "sin", "businessNumber", "federalBN", "neq", "gstNumber", "qstNumber", "regNumber", "payrollAccount", "rpAccount"].includes(key)) {
        const text = typeof child === "string" ? child.replace(/\s/g, "") : "";
        result[`${key}Last4`] = text ? text.slice(-4) : null;
      } else result[key] = redact(child);
    }
    return result;
  };
  return redact(input) as Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json() as Record<string, unknown> & { type?: string };
  if (body.type !== "INDIVIDUAL" && body.type !== "BUSINESS") return NextResponse.json({ error: "Type de compte invalide" }, { status: 400 });
  const submittedProvince = body.type === "BUSINESS" ? body.bizProvince ?? body.province : body.province;
  const requiredAddress = [body.address, body.city, submittedProvince, body.postal].every(value => typeof value === "string" && value.trim().length > 0);
  if (!requiredAddress) return NextResponse.json({ error: "L’adresse complète est obligatoire : rue, ville, province ou territoire et code postal." }, { status: 422 });
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  if (!existing[0]) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  if (body.type === "INDIVIDUAL") {
    const existingProfile = await db.select({ id: taxProfiles.id }).from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
    if (existingProfile[0]) return NextResponse.json({ profileId: existingProfile[0].id, existing: true });
    const province = normalizeProvinceCode(body.province);
    if (!province) return NextResponse.json({ error: "Province ou territoire invalide." }, { status: 422 });
    const fiscalResidence = normalizeProvinceCode(body.taxProvince) ?? province;
    const years = await db.select({ id: taxYears.id }).from(taxYears).where(eq(taxYears.year, Number(body.taxYear) || 2025)).limit(1);
    const [created] = await db.insert(taxProfiles).values({
      userId: clerkUserId,
      firstName: String(body.firstName ?? ""), lastName: String(body.lastName ?? ""),
      dateOfBirth: typeof body.birthDate === "string" && body.birthDate ? body.birthDate : null,
      sinLastFour: typeof body.nas === "string" ? body.nas.replace(/\s/g, "").slice(-4) || null : null,
      phone: body.phone ? String(body.phone) : null, email: body.email ? String(body.email) : null,
      address: body.address ? String(body.address) : null, city: body.city ? String(body.city) : null,
      province, postalCode: body.postal ? String(body.postal) : null,
      fiscalResidence,
      isCanadianCitizen: typeof body.canadaStatus === "string" ? body.canadaStatus.toLowerCase().includes("citoyen") : null,
      isQuebecResident: fiscalResidence === "QC", pancanadianData: JSON.stringify(safeMetadata(body)),
    }).returning({ id: taxProfiles.id });
    return NextResponse.json({ profileId: created.id, taxYearId: years[0]?.id ?? null, created: true });
  }

  const existingOrg = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.ownerUserId, clerkUserId)).limit(1);
  if (existingOrg[0]) return NextResponse.json({ organizationId: existingOrg[0].id, existing: true });
  const province = normalizeProvinceCode(submittedProvince);
  if (!province) return NextResponse.json({ error: "Province ou territoire invalide." }, { status: 422 });
  const [org] = await db.insert(organizations).values({
    ownerUserId: clerkUserId,
    type: body.legalForm === "Travailleur autonome / entreprise individuelle" ? "SOLE_PROPRIETORSHIP" : "BUSINESS",
    legalName: String(body.legalName ?? "Entreprise sans nom"), tradeName: body.tradeName ? String(body.tradeName) : null,
    businessNumberLast4: typeof body.federalBN === "string" ? body.federalBN.replace(/\s/g, "").slice(-4) || null : null,
    province, address: body.address ? String(body.address) : null, city: body.city ? String(body.city) : null,
    postalCode: body.postal ? String(body.postal) : null, phone: body.bizPhone ? String(body.bizPhone) : null,
    email: body.contactEmail ? String(body.contactEmail) : null, pancanadianData: JSON.stringify(safeMetadata(body)),
  }).returning({ id: organizations.id, legalName: organizations.legalName });
  await db.insert(organizationMemberships).values({ organizationId: org.id, userId: clerkUserId, role: "OWNER", status: "active", acceptedAt: new Date() });
  await db.update(users).set({ role: "BUSINESS", updatedAt: new Date() }).where(eq(users.clerkUserId, clerkUserId));
  return NextResponse.json({ organizationId: org.id, organization: org, created: true }, { status: 201 });
}
