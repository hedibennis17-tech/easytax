import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes publiques — accessibles sans authentification
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing(.*)",
  "/about(.*)",
  "/help(.*)",
  "/confidentialite(.*)",
  "/conditions(.*)",
  "/securite(.*)",
  "/contact(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  // Protéger toutes les routes non-publiques
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Protéger toutes les routes sauf fichiers statiques Next.js
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
