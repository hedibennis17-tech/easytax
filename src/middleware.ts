import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/dossier(.*)",
  "/documents(.*)",
  "/onboarding(.*)",
  "/settings(.*)",
  "/admin(.*)",
  "/api/documents(.*)",
  "/api/profile(.*)",
  "/api/tax-returns(.*)",
  "/api/access-codes(.*)",
  "/api/questions(.*)",
  "/api/jurisdictions(.*)",
  "/api/user(.*)",
  "/api/auth/sync(.*)",
  "/api/auth/complete-onboarding(.*)",
]);

// Routes complètement exemptées de Clerk — protégées par leur propre mécanisme
const isExemptRoute = createRouteMatcher([
  "/api/admin(.*)",
  "/api/debug(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // Routes admin : bypass total de Clerk (token secret gère la sécurité)
  if (isExemptRoute(request)) {
    return NextResponse.next();
  }
  // Routes privées : Clerk obligatoire
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
