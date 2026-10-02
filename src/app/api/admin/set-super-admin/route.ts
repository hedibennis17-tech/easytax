import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const token = params.get("token");
  const email = params.get("email");
  const clerkUserId = params.get("clerkId");
  const firstName = params.get("firstName") ?? "Hedi";
  const lastName = params.get("lastName") ?? "Bennis";

  if (token !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!email && !clerkUserId) {
    return NextResponse.json({ error: "email ou clerkId requis" }, { status: 400 });
  }

  // Chercher par clerkId ou email
  const existing = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(
      clerkUserId
        ? eq(users.clerkUserId, clerkUserId)
        : sql`lower(${users.email}) = lower(${email})`
    )
    .limit(1);

  if (existing.length > 0) {
    // Mettre à jour
    await db.update(users)
      .set({ role: "SUPER_ADMIN", updatedAt: new Date() })
      .where(eq(users.id, existing[0].id));

    return NextResponse.json({
      success: true,
      action: "updated",
      user: { ...existing[0], role: "SUPER_ADMIN" },
      message: "✅ SUPER_ADMIN activé",
    });
  }

  // Créer l'user directement
  if (!clerkUserId || !email) {
    return NextResponse.json({
      error: "User non trouvé. Fournir clerkId ET email pour créer.",
    }, { status: 404 });
  }

  const [created] = await db.insert(users).values({
    clerkUserId,
    email,
    firstName,
    lastName,
    role: "SUPER_ADMIN",
    status: "active",
    onboardingCompleted: true,
    lastSignInAt: new Date(),
  }).returning({ id: users.id, email: users.email, role: users.role });

  return NextResponse.json({
    success: true,
    action: "created",
    user: created,
    message: "✅ SUPER_ADMIN créé",
  });
}
