import { NextRequest, NextResponse } from "next/server";
import { neon, neonConfig } from "@neondatabase/serverless";
import { MIGRATIONS } from "@/lib/migrations-data";

neonConfig.fetchConnectionCache = true;

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-migrate-token");
  if (token !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const results: string[] = [];
  const errors: string[] = [];

  for (const migration of MIGRATIONS) {
    let ok = 0, skip = 0;

    for (const stmt of migration.statements) {
      try {
        await sql.unsafe(stmt);
        ok++;
      } catch (e: any) {
        const msg = e.message ?? "";
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate") ||
          msg.includes("DuplicateObject") ||
          msg.includes("already exists as")
        ) {
          skip++;
        } else {
          errors.push(`${migration.file}: ${msg.substring(0, 120)}`);
        }
      }
    }

    results.push(`${migration.file}: ${ok} exécutés, ${skip} déjà existants`);
  }

  return NextResponse.json({
    success: errors.length === 0,
    results,
    errors,
    totalMigrations: MIGRATIONS.length,
  });
}
