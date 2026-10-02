import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  await db
    .update(users)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(users.clerkUserId, clerkUserId));

  return NextResponse.json({ ok: true });
}
