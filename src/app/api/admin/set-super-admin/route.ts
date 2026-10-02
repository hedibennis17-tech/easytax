import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const email = req.nextUrl.searchParams.get("email");

  if (token !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!email) {
    return NextResponse.json({ error: "email requis" }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);

  // Vérifier si user existe
  const existing = await sql(
    `SELECT id, email, role, clerk_user_id FROM users WHERE email ILIKE $1 LIMIT 1`,
    [email]
  );

  if (existing.length === 0) {
    // Créer l'user si pas encore connecté
    return NextResponse.json({
      error: "User non trouvé. Connecte-toi d'abord sur /dashboard puis rappelle cet endpoint.",
      email,
    }, { status: 404 });
  }

  // Upgrader en SUPER_ADMIN
  await sql(
    `UPDATE users SET role = 'SUPER_ADMIN', updated_at = NOW() WHERE email ILIKE $1`,
    [email]
  );

  const updated = await sql(
    `SELECT id, email, role, clerk_user_id FROM users WHERE email ILIKE $1 LIMIT 1`,
    [email]
  );

  return NextResponse.json({
    success: true,
    user: updated[0],
    message: "✅ Compte upgradé en SUPER_ADMIN",
  });
}
