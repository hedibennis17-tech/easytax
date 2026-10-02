import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { MIGRATIONS } from "@/lib/migrations-data";

async function runMigrations() {
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
          msg.includes("DuplicateObject")
        ) {
          skip++;
        } else {
          errors.push(`${migration.file}: ${msg.substring(0, 120)}`);
        }
      }
    }
    results.push(`${migration.file}: ${ok} OK, ${skip} skipped`);
  }
  return { results, errors };
}

// GET — déclenché depuis le browser directement
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { results, errors } = await runMigrations();
  return NextResponse.json({ success: errors.length === 0, results, errors });
}

// POST — conservé pour compatibilité
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-migrate-token");
  if (token !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { results, errors } = await runMigrations();
  return NextResponse.json({ success: errors.length === 0, results, errors });
}
