import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/dossier(.*)",
  "/documents(.*)",
  "/questionnaire(.*)",
  "/resume(.*)",
  "/onboarding(.*)",
  "/settings(.*)",
  // Étape 4.5 — nouveaux espaces
  "/business(.*)",
  "/preparer(.*)",
  "/admin(.*)",
  // APIs protégées
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
]);

const isAdminMigrateRoute = createRouteMatcher(["/api/admin/migrate"]);

export default clerkMiddleware(async (auth, request) => {
  if (isAdminMigrateRoute(request)) {
    return NextResponse.next();
  }

  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
