import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes protégées — tout le reste est public
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

export default clerkMiddleware(async (auth, request) => {
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
