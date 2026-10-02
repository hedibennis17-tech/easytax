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
  "/api/auth(.*)",
]);

const isAdminMigrateRoute = createRouteMatcher(["/api/admin/migrate"]);

export default clerkMiddleware(async (auth, request) => {
  // Route de migration — vérifiée par token secret, pas par Clerk
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
