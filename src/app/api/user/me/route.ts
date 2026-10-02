import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, getTaxProfileByClerkId } from "@/lib/user-service";

/**
 * GET /api/user/me
 * Retourne l'utilisateur EasyTax connecté + son profil fiscal.
 * L'identité vient de la session Clerk — jamais d'un paramètre frontend.
 */
export async function GET() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const user = await getUserByClerkId(clerkUserId);
  if (!user) {
    return NextResponse.json({ error: "Utilisateur EasyTax introuvable. Lancez /api/auth/sync" }, { status: 404 });
  }

  const taxProfile = await getTaxProfileByClerkId(clerkUserId);

  return NextResponse.json({
    id: user.id,
    clerkUserId: user.clerkUserId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    onboardingCompleted: user.onboardingCompleted,
    hasTaxProfile: !!taxProfile,
    taxProfileId: taxProfile?.id ?? null,
  });
}
