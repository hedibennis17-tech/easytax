import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPreparerClients } from "@/lib/org-service";
import { db } from "@/lib/db";
import { preparerProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

// GET /api/preparer/clients — Clients du préparateur connecté
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Vérifier que l'utilisateur est bien un préparateur actif
  const [profile] = await db
    .select()
    .from(preparerProfiles)
    .where(eq(preparerProfiles.userId, userId))
    .limit(1);

  if (!profile || !profile.isActive) {
    return NextResponse.json({ error: "Profil préparateur introuvable" }, { status: 404 });
  }

  const clients = await getPreparerClients(userId);

  return NextResponse.json({ clients, preparerId: profile.id });
}
