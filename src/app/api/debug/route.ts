import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, taxProfiles, fiscalDocuments, taxReturns, taxYears } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET() {
  const result: Record<string, any> = {};

  // 1. Clerk
  try {
    const { userId } = await auth();
    const clerkUser = await currentUser();
    result.clerk = {
      status: userId ? "authenticated" : "not_authenticated",
      userId,
      email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? null,
      firstName: clerkUser?.firstName ?? null,
    };
  } catch (e: any) {
    result.clerk = { error: e.message };
  }

  // 2. ENV
  result.env = {
    DATABASE_URL: process.env.DATABASE_URL ? "✅" : "❌ MANQUANT",
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? "✅" : "❌ MANQUANT",
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? "✅" : "❌ MANQUANT",
    NEON_STORAGE_BUCKET: process.env.NEON_STORAGE_BUCKET ?? "❌ MANQUANT",
  };

  const clerkUserId = result.clerk?.userId;
  if (!clerkUserId) {
    result.message = "Non connecté — connecte-toi d'abord sur /sign-in";
    return NextResponse.json(result);
  }

  // 3. User EasyTax
  try {
    const userRows = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
    result.easytax_user = userRows[0] ?? "❌ PAS TROUVÉ EN DB — sync pas fait";
  } catch (e: any) {
    result.easytax_user = { error: e.message };
  }

  // 4. Tax Profile
  try {
    const profileRows = await db.select().from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
    result.tax_profile = profileRows[0] ?? "❌ AUCUN PROFIL FISCAL";
  } catch (e: any) {
    result.tax_profile = { error: e.message };
  }

  // 5. Tax Years
  try {
    const years = await db.select().from(taxYears).orderBy(taxYears.year);
    result.tax_years = years.length > 0 ? years : "❌ AUCUNE ANNÉE FISCALE — seed pas fait";
  } catch (e: any) {
    result.tax_years = { error: e.message };
  }

  // 6. Documents
  try {
    const [docCount] = await db.select({ count: count() }).from(fiscalDocuments).where(eq(fiscalDocuments.userId, clerkUserId));
    const recentDocs = await db.select({
      id: fiscalDocuments.id,
      originalFilename: fiscalDocuments.originalFilename,
      status: fiscalDocuments.status,
      uploadedAt: fiscalDocuments.uploadedAt,
    }).from(fiscalDocuments).where(eq(fiscalDocuments.userId, clerkUserId)).limit(5);
    result.documents = { total: docCount.count, recent: recentDocs };
  } catch (e: any) {
    result.documents = { error: e.message };
  }

  // 7. Tax Returns
  try {
    const [retCount] = await db.select({ count: count() }).from(taxReturns)
      .innerJoin(taxProfiles, eq(taxReturns.profileId, taxProfiles.id))
      .where(eq(taxProfiles.userId, clerkUserId));
    result.tax_returns = { total: retCount.count };
  } catch (e: any) {
    result.tax_returns = { error: e.message };
  }

  return NextResponse.json(result, { status: 200 });
}
