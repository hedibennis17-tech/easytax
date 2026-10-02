import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const email = req.nextUrl.searchParams.get("email");

  if (token !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!email) {
    return NextResponse.json({ error: "email requis" }, { status: 400 });
  }

  const existing = await db
    .select({ id: users.id, email: users.email, role: users.role, clerkUserId: users.clerkUserId })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({
      error: "User non trouvé. Connecte-toi d'abord sur /dashboard puis rappelle cet endpoint.",
    }, { status: 404 });
  }

  await db
    .update(users)
    .set({ role: "SUPER_ADMIN", updatedAt: new Date() })
    .where(sql`lower(${users.email}) = lower(${email})`);

  return NextResponse.json({
    success: true,
    user: { ...existing[0], role: "SUPER_ADMIN" },
    message: "✅ Compte upgradé en SUPER_ADMIN",
  });
}
