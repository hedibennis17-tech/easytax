import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  let clerkStatus = "unknown";
  let userId = null;

  try {
    const session = await auth();
    userId = session.userId;
    clerkStatus = userId ? "authenticated" : "not_authenticated";
  } catch (e) {
    clerkStatus = "error: " + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json({
    env: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        ? "✅ " + process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.slice(0, 12) + "..."
        : "❌ MANQUANT",
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY
        ? "✅ sk_..." 
        : "❌ MANQUANT",
      DATABASE_URL: process.env.DATABASE_URL
        ? "✅ configuré"
        : "❌ MANQUANT",
      SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL ?? "non défini",
      SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL ?? "non défini",
    },
    clerk: {
      status: clerkStatus,
      userId,
    },
    middleware: "voir /api/debug/middleware",
  });
}
