import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  taxYearAccessCodes,
  taxProfiles,
  jurisdictions,
  governmentAuditLogs,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

// Masquer un code pour l'affichage UI — jamais le code complet en réponse
function maskCode(last4: string | null): string {
  if (!last4) return "••••••••";
  return `••••••${last4}`;
}

// GET /api/access-codes?taxYearId=xxx
// Retourne les codes MASQUÉS de l'utilisateur pour une année
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taxYearId = searchParams.get("taxYearId");

  const profile = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, userId))
    .limit(1);

  if (profile.length === 0) return NextResponse.json({ codes: [] });

  const conditions = [
    eq(taxYearAccessCodes.taxProfileId, profile[0].id),
  ];
  if (taxYearId) conditions.push(eq(taxYearAccessCodes.taxYearId, taxYearId));

  const codes = await db
    .select({
      id: taxYearAccessCodes.id,
      codeType: taxYearAccessCodes.codeType,
      // JAMAIS codeEncrypted — seulement les 4 derniers chiffres
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

  // Masquer les codes dans la réponse
  return NextResponse.json({
    codes: codes.map((c) => ({
      ...c,
      codeMasked: maskCode(c.codeMasked),
    })),
  });
}

// POST /api/access-codes — Ajouter un code annuel
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { taxYearId, codeType, codeValue, government, jurisdictionId, expiresAt } = body;

  if (!taxYearId || !codeType || !codeValue || !government) {
    return NextResponse.json({ error: "Champs requis: taxYearId, codeType, codeValue, government" }, { status: 400 });
  }

  const profile = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, userId))
    .limit(1);

  if (profile.length === 0) {
    return NextResponse.json({ error: "Profil fiscal introuvable" }, { status: 404 });
  }

  // Chiffrement du code — TODO: remplacer par AES-256 réel à l'étape sécurité
  // Pour l'instant : hash SHA-256 comme placeholder sécurisé
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

  // Audit — jamais le code dans les logs
  await db.insert(governmentAuditLogs).values({
    userId,
    taxProfileId: profile[0].id,
    action: "government_code_created",
    metadata: JSON.stringify({ codeType, government, taxYearId }),
  });

  return NextResponse.json({ id: created.id, codeType: created.codeType, message: "Code ajouté." }, { status: 201 });
}
