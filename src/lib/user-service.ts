/**
 * UserService — Synchronisation Clerk → EasyTax
 *
 * Après chaque connexion Clerk, on s'assure qu'un enregistrement
 * EasyTax User existe et est à jour. Idempotent : jamais de doublon.
 */

import { db } from "@/lib/db";
import { users, taxProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ClerkUserData {
  clerkUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Récupérer ou créer un utilisateur EasyTax à partir de l'identité Clerk.
 * Appelé après chaque authentification réussie.
 * IDEMPOTENT — ne crée jamais de doublon.
 */
export async function getOrCreateUser(clerkData: ClerkUserData) {
  // 1. Chercher l'utilisateur existant
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkData.clerkUserId))
    .limit(1);

  if (existing[0]) {
    // Mettre à jour lastSignInAt + infos Clerk si changées
    await db
      .update(users)
      .set({
        email: clerkData.email,
        firstName: clerkData.firstName ?? existing[0].firstName,
        lastName: clerkData.lastName ?? existing[0].lastName,
        lastSignInAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.clerkUserId, clerkData.clerkUserId));

    return existing[0];
  }

  // 2. Créer le nouvel utilisateur EasyTax
  const [created] = await db
    .insert(users)
    .values({
      clerkUserId: clerkData.clerkUserId,
      email: clerkData.email,
      firstName: clerkData.firstName ?? null,
      lastName: clerkData.lastName ?? null,
      role: "INDIVIDUAL", // rôle par défaut
      status: "active",
      onboardingCompleted: false,
      lastSignInAt: new Date(),
    })
    .returning();

  return created;
}

/**
 * Récupérer un utilisateur EasyTax par Clerk ID (côté serveur uniquement)
 */
export async function getUserByClerkId(clerkUserId: string) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Vérifier si un utilisateur a le rôle ADMIN ou SUPER_ADMIN (côté serveur)
 * NE JAMAIS faire cette vérification uniquement côté frontend
 */
export async function isAdmin(clerkUserId: string): Promise<boolean> {
  const user = await getUserByClerkId(clerkUserId);
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

/**
 * Vérifier un rôle spécifique côté serveur
 */
export async function hasRole(
  clerkUserId: string,
  roles: Array<"INDIVIDUAL" | "PREPARER" | "BUSINESS" | "ADMIN" | "SUPER_ADMIN">
): Promise<boolean> {
  const user = await getUserByClerkId(clerkUserId);
  if (!user) return false;
  return roles.includes(user.role as typeof roles[0]);
}

/**
 * Récupérer le profil fiscal lié à un utilisateur Clerk
 */
export async function getTaxProfileByClerkId(clerkUserId: string) {
  const user = await getUserByClerkId(clerkUserId);
  if (!user) return null;

  const profiles = await db
    .select()
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, user.clerkUserId))
    .limit(1);

  return profiles[0] ?? null;
}
