/**
 * require-profile.ts
 * Helper serveur — vérifie que le user a un tax_profile complet.
 * À appeler dans toutes les pages protégées INDIVIDUAL.
 * Redirige vers /onboarding si profil manquant.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, taxProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function requireProfile() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  // Vérifier user EasyTax
  const userRows = await db.select({
    id: users.id,
    role: users.role,
    onboardingCompleted: users.onboardingCompleted,
  }).from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);

  // Pas de user → créer et wizard
  if (!userRows[0]) redirect("/onboarding");

  const user = userRows[0];

  // Onboarding pas complété
  if (!user.onboardingCompleted) redirect("/onboarding");

  // Vérifier tax_profile
  const profileRows = await db.select({ id: taxProfiles.id, firstName: taxProfiles.firstName })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);

  // Pas de profil → forcer wizard même si onboarding=true (compte ancien)
  if (!profileRows[0]) {
    // Réinitialiser onboardingCompleted pour forcer le wizard
    await db.update(users)
      .set({ onboardingCompleted: false, updatedAt: new Date() })
      .where(eq(users.clerkUserId, clerkUserId));
    redirect("/onboarding");
  }

  return {
    clerkUserId,
    userId: user.id,
    role: user.role,
    profile: profileRows[0],
  };
}
