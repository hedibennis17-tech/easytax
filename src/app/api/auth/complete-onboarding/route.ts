import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, taxProfiles, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [profile] = await db.select({ address: taxProfiles.address, city: taxProfiles.city, province: taxProfiles.province, postalCode: taxProfiles.postalCode })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  const [organization] = await db.select({ address: organizations.address, city: organizations.city, province: organizations.province, postalCode: organizations.postalCode })
    .from(organizations).where(eq(organizations.ownerUserId, clerkUserId)).limit(1);
  const record = profile ?? organization;
  if (!record || !record.address || !record.city || !record.province || !record.postalCode) {
    return NextResponse.json({ error: "Une adresse complète est obligatoire avant de commencer la déclaration." }, { status: 422 });
  }

  await db
    .update(users)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(users.clerkUserId, clerkUserId));

  return NextResponse.json({ ok: true });
}
