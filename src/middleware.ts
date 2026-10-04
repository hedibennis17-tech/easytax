import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// Routes qui nécessitent juste d'être connecté
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/dossier(.*)",
  "/documents(.*)",
  "/questionnaire(.*)",
  "/resume(.*)",
  "/declarations(.*)",
  "/profil(.*)",
  "/onboarding(.*)",
  "/settings(.*)",
  "/business(.*)",
  "/business/questionnaire(.*)",
  "/preparer(.*)",
  "/admin(.*)",
  "/api/documents(.*)",
  "/api/profile(.*)",
  "/api/tax-returns(.*)",
  "/api/tax-engine(.*)",
  "/api/access-codes(.*)",
  "/api/questions(.*)",
  "/api/answers(.*)",
  "/api/jurisdictions(.*)",
  "/api/user(.*)",
  "/api/auth(.*)",
  "/api/organizations(.*)",
  "/api/invitations(.*)",
  "/api/preparer(.*)",
  "/api/notifications(.*)",
  "/api/debug/ocr(.*)",
]);

// Route de migration — pas de vérification Clerk
const isAdminMigrateRoute = createRouteMatcher(["/api/admin/migrate"]);

// Routes qui nécessitent un rôle spécifique (vérification légère en middleware)
// La vérification complète est toujours faite dans chaque page/API côté serveur
const ADMIN_ROUTES    = ["/admin"];
const BUSINESS_ROUTES = ["/business"];
const PREPARER_ROUTES = ["/preparer"];

function startsWithAny(path: string, prefixes: string[]): boolean {
  return prefixes.some((p) => path === p || path.startsWith(p + "/"));
}

export default clerkMiddleware(async (auth, request: NextRequest) => {
  if (isAdminMigrateRoute(request)) return NextResponse.next();

  if (!isProtectedRoute(request)) return NextResponse.next();

  // 1. Vérifier que l'utilisateur est connecté
  const { userId } = await auth();
  if (!userId) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect_url", request.url);
    return NextResponse.redirect(signInUrl);
  }

  const pathname = request.nextUrl.pathname;

  // 2. Vérification rôle pour les routes sensibles
  // On lit le rôle depuis notre DB via un appel léger
  if (
    startsWithAny(pathname, ADMIN_ROUTES) ||
    startsWithAny(pathname, BUSINESS_ROUTES) ||
    startsWithAny(pathname, PREPARER_ROUTES)
  ) {
    try {
      // Appel interne à notre API pour lire le rôle
      const roleRes = await fetch(
        new URL("/api/user/me", request.url).toString(),
        {
          headers: {
            cookie: request.headers.get("cookie") ?? "",
            "x-middleware-check": "1",
          },
        }
      );

      if (roleRes.ok) {
        const data = await roleRes.json() as { role?: string };
        const role = data.role ?? "INDIVIDUAL";

        // Bloquer admin aux non-admins
        if (startsWithAny(pathname, ADMIN_ROUTES)) {
          if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }
        }

        // Bloquer business aux non-business (sauf admin)
        if (startsWithAny(pathname, BUSINESS_ROUTES)) {
          if (!["BUSINESS", "ADMIN", "SUPER_ADMIN"].includes(role)) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }
        }

        // Bloquer preparer aux non-preparers (sauf admin)
        if (startsWithAny(pathname, PREPARER_ROUTES)) {
          if (!["PREPARER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }
        }
      }
    } catch {
      // En cas d'erreur réseau, laisser passer — la page vérifie aussi
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
