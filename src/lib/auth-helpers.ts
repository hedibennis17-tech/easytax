/**
 * Helpers d'authentification côté serveur
 *
 * RÈGLE ABSOLUE :
 * L'identité utilisateur doit TOUJOURS venir de la session Clerk côté serveur.
 * NE JAMAIS faire confiance à un userId envoyé depuis le navigateur.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserByClerkId } from "@/lib/user-service";

export interface AuthContext {
  clerkUserId: string;
  easyTaxUserId: string;
  role: string;
}

/**
 * Récupérer le contexte auth depuis la session Clerk.
 * Retourne null si non authentifié ou utilisateur EasyTax inexistant.
 *
 * Usage dans une route API :
 *   const ctx = await getAuthContext();
 *   if (!ctx) return unauthorized();
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const user = await getUserByClerkId(clerkUserId);
  if (!user || user.status !== "active") return null;

  return {
    clerkUserId,
    easyTaxUserId: user.id,
    role: user.role,
  };
}

/**
 * Réponse 401 standardisée
 */
export function unauthorized() {
  return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
}

/**
 * Réponse 403 standardisée
 */
export function forbidden() {
  return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
}

/**
 * Vérifier qu'un utilisateur a le rôle ADMIN côté serveur
 * NE JAMAIS utiliser uniquement côté frontend
 */
export async function requireAdmin(): Promise<AuthContext | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  if (ctx.role !== "ADMIN" && ctx.role !== "SUPER_ADMIN") return null;
  return ctx;
}
