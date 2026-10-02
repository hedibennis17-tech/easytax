import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/user-service";

/**
 * POST /api/auth/sync
 * Synchronise l'utilisateur Clerk avec la table users EasyTax.
 * Appelé automatiquement après connexion depuis le client.
 * L'identité vient TOUJOURS de la session Clerk côté serveur — jamais du body.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Récupérer les infos Clerk côté serveur
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Utilisateur Clerk introuvable" }, { status: 401 });
  }

  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? "";

  // Sync idempotente
  const user = await getOrCreateUser({
    clerkUserId,
    email,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
  });

  return NextResponse.json({
    id: user.id,
    role: user.role,
    onboardingCompleted: user.onboardingCompleted,
    status: user.status,
  });
}
