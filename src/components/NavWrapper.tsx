import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/user-service";
import { getWorkspaceConfig, type UserRole } from "@/lib/workspace";
import { AppNav } from "./AppNav";

/**
 * NavWrapper — Server Component
 * Lit le rôle depuis la DB côté serveur,
 * passe les bons liens à AppNav (client).
 * Jamais de rôle depuis le frontend.
 */
export async function NavWrapper() {
  const { userId: clerkUserId } = await auth();

  // Défaut sécurisé : si pas connecté ou erreur → nav vide
  let role: UserRole = "INDIVIDUAL";

  if (clerkUserId) {
    try {
      const user = await getUserByClerkId(clerkUserId);
      if (user?.role) role = user.role as UserRole;
    } catch {
      // Silencieux — on garde INDIVIDUAL par défaut
    }
  }

  const config = getWorkspaceConfig(role);

  return (
    <AppNav
      navItems={config.navItems}
      workspaceLabel={config.workspaceLabel}
      role={role}
      homeHref={config.homeHref}
    />
  );
}
