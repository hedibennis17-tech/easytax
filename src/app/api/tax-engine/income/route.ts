import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, incomeEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/tax-engine/income?taxReturnId=xxx
export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const taxReturnId = req.nextUrl.searchParams.get("taxReturnId");
  if (!taxReturnId) return NextResponse.json({ error: "taxReturnId requis" }, { status: 400 });

  const entries = await db.select().from(incomeEntries)
    .where(and(eq(incomeEntries.userId, clerkUserId), eq(incomeEntries.taxReturnId, taxReturnId)))
    .orderBy(incomeEntries.category);

  return NextResponse.json({ incomes: entries });
}

// POST /api/tax-engine/income — Ajouter un revenu manuellement
export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { taxReturnId, taxYearId, category, amountCents, description, employerName } = body;

  if (!taxReturnId || !taxYearId || !category || amountCents === undefined) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  // Validation monétaire — doit être un entier
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    return NextResponse.json({ error: "amountCents doit être un entier positif" }, { status: 400 });
  }

  const profile = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile[0]) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [entry] = await db.insert(incomeEntries).values({
    userId: clerkUserId,
    taxProfileId: profile[0].id,
    taxYearId,
    taxReturnId,
    category,
    amountCents,
    description: description ?? null,
    employerName: employerName ?? null,
    sourceType: "manual",
    isValidated: true, // Saisie manuelle = validée par l'utilisateur
    validatedAt: new Date(),
    validatedByUserId: clerkUserId,
  }).returning();

  return NextResponse.json(entry, { status: 201 });
}
