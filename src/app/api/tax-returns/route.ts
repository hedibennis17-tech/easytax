import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxReturns, taxProfiles, taxYears } from "@/db/schema";
import { eq } from "drizzle-orm";

function getUserId(req: NextRequest): string | null {
  // TODO étape 2 : session auth réelle
  return req.headers.get("x-user-id");
}

// GET /api/tax-returns — Lister ses dossiers fiscaux
export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Trouver le profil de l'utilisateur
  const profile = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, userId))
    .limit(1);

  if (profile.length === 0) {
    return NextResponse.json({ returns: [] });
  }

  const returns = await db
    .select({
      id: taxReturns.id,
      status: taxReturns.status,
      federalStatus: taxReturns.federalStatus,
      quebecStatus: taxReturns.quebecStatus,
      version: taxReturns.version,
      estimatedFederalRefund: taxReturns.estimatedFederalRefund,
      estimatedQuebecRefund: taxReturns.estimatedQuebecRefund,
      createdAt: taxReturns.createdAt,
      updatedAt: taxReturns.updatedAt,
      year: taxYears.year,
      yearStatus: taxYears.status,
    })
    .from(taxReturns)
    .innerJoin(taxYears, eq(taxReturns.taxYearId, taxYears.id))
    .where(eq(taxReturns.profileId, profile[0].id))
    .orderBy(taxYears.year);

  return NextResponse.json({ returns });
}

// POST /api/tax-returns — Créer un nouveau dossier fiscal
export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const { taxYearId } = body;

  const profile = await db
    .select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, userId))
    .limit(1);

  if (profile.length === 0) {
    return NextResponse.json(
      { error: "Créez d'abord votre profil fiscal" },
      { status: 400 }
    );
  }

  // Vérifier qu'un dossier n'existe pas déjà pour cette année
  const existing = await db
    .select({ id: taxReturns.id })
    .from(taxReturns)
    .where(eq(taxReturns.profileId, profile[0].id))
    .limit(1);

  // (filtrage par année à ajouter si besoin)

  const [created] = await db
    .insert(taxReturns)
    .values({
      profileId: profile[0].id,
      taxYearId,
      status: "draft",
      federalStatus: "draft",
      quebecStatus: "draft",
      version: 1,
    })
    .returning({ id: taxReturns.id, status: taxReturns.status });

  return NextResponse.json(created, { status: 201 });
}
