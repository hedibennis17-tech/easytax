import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Sécurité : dans cette étape, on simule l'auth via un header x-user-id.
 * L'étape 2 branchera un vrai système d'authentification.
 * Les routes REFUSENT toute requête sans userId.
 */
function getUserId(req: NextRequest): string | null {
  // TODO étape 2 : remplacer par session auth réelle (NextAuth / Clerk)
  return req.headers.get("x-user-id");
}

// GET /api/profile — Récupérer son profil fiscal
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const profile = await db
    .select({
      id: taxProfiles.id,
      firstName: taxProfiles.firstName,
      lastName: taxProfiles.lastName,
      dateOfBirth: taxProfiles.dateOfBirth,
      // NAS : on ne retourne JAMAIS sinEncrypted — seulement les 4 derniers chiffres
      sinLastFour: taxProfiles.sinLastFour,
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
    .where(eq(taxProfiles.userId, userId))
    .limit(1);

  if (profile.length === 0) {
    return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
  }

  return NextResponse.json(profile[0]);
}

// POST /api/profile — Créer son profil fiscal
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();

  // Vérifier si un profil existe déjà
  const existing = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "Un profil existe déjà pour cet utilisateur" },
      { status: 409 }
    );
  }

  const [created] = await db
    .insert(taxProfiles)
    .values({
      userId,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth: body.dateOfBirth,
      // NAS : accepté mais stocké chiffré — à implémenter étape sécurité
      // sinEncrypted: encryptSIN(body.sin), // TODO
      sinLastFour: body.sin ? String(body.sin).slice(-4) : null,
      phone: body.phone,
      email: body.email,
      address: body.address,
      city: body.city,
      province: body.province,
      postalCode: body.postalCode,
      maritalStatus: body.maritalStatus,
      fiscalResidence: body.fiscalResidence,
      isCanadianCitizen: body.isCanadianCitizen,
      isQuebecResident: body.isQuebecResident ?? false,
    })
    .returning({ id: taxProfiles.id, firstName: taxProfiles.firstName });

  return NextResponse.json(created, { status: 201 });
}
