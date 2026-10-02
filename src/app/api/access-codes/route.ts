import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxYearAccessCodes, taxProfiles, jurisdictions, governmentAuditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { createHash } from "crypto";

function maskCode(last4: string | null): string {
  if (!last4) return "••••••••";
  return `••••••${last4}`;
}

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(req.url);
  const taxYearId = searchParams.get("taxYearId");

  const profile = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, ctx.clerkUserId))
    .limit(1);

  if (profile.length === 0) return NextResponse.json({ codes: [] });

  const conditions = [eq(taxYearAccessCodes.taxProfileId, profile[0].id)];
  if (taxYearId) conditions.push(eq(taxYearAccessCodes.taxYearId, taxYearId));

  const codes = await db
    .select({
      id: taxYearAccessCodes.id,
      codeType: taxYearAccessCodes.codeType,
      codeMasked: taxYearAccessCodes.codeLast4,
      status: taxYearAccessCodes.status,
      government: taxYearAccessCodes.government,
      issuedAt: taxYearAccessCodes.issuedAt,
      expiresAt: taxYearAccessCodes.expiresAt,
      verifiedAt: taxYearAccessCodes.verifiedAt,
      lastUsedAt: taxYearAccessCodes.lastUsedAt,
      taxYearId: taxYearAccessCodes.taxYearId,
      jurisdictionCode: jurisdictions.code,
      jurisdictionNameFr: jurisdictions.nameFr,
      createdAt: taxYearAccessCodes.createdAt,
    })
    .from(taxYearAccessCodes)
    .leftJoin(jurisdictions, eq(taxYearAccessCodes.jurisdictionId, jurisdictions.id))
    .where(and(...conditions))
    .orderBy(taxYearAccessCodes.createdAt);

  return NextResponse.json({
    codes: codes.map((c) => ({ ...c, codeMasked: maskCode(c.codeMasked) })),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const body = await req.json();
  const { taxYearId, codeType, codeValue, government, jurisdictionId, expiresAt } = body;

  if (!taxYearId || !codeType || !codeValue || !government) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const profile = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, ctx.clerkUserId))
    .limit(1);

  if (profile.length === 0) {
    return NextResponse.json({ error: "Profil fiscal introuvable" }, { status: 404 });
  }

  const codeEncrypted = createHash("sha256").update(codeValue).digest("hex");
  const codeLast4 = String(codeValue).slice(-4);

  const [created] = await db
    .insert(taxYearAccessCodes)
    .values({
      taxProfileId: profile[0].id,
      taxYearId,
      codeType,
      codeEncrypted,
      codeLast4,
      status: "active",
      government,
      jurisdictionId: jurisdictionId ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning({ id: taxYearAccessCodes.id, codeType: taxYearAccessCodes.codeType });

  await db.insert(governmentAuditLogs).values({
    userId: ctx.clerkUserId,
    taxProfileId: profile[0].id,
    action: "government_code_created",
    metadata: JSON.stringify({ codeType, government, taxYearId }),
  });

  return NextResponse.json({ id: created.id, codeType: created.codeType }, { status: 201 });
}
