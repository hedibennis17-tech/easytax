import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

// Route de migration — sécurisée par token secret
// Appelée une seule fois depuis Vercel pour appliquer toutes les migrations
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-migrate-token");
  if (token !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const results: string[] = [];
  const errors: string[] = [];

  // Lire les migrations dans l'ordre
  const migrationFiles = [
    "0000_greedy_stranger.sql",
    "0001_cold_blur.sql",
    "0002_bouncy_supernaut.sql",
    "0003_daffy_bulldozer.sql",
    "0004_simple_slyde.sql",
  ];

  for (const file of migrationFiles) {
    try {
      // En production sur Vercel, les fichiers drizzle sont dans le bundle
      const filePath = path.join(process.cwd(), "drizzle", file);
      const content = fs.readFileSync(filePath, "utf8");
      const statements = content
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      let ok = 0;
      let skip = 0;
      for (const stmt of statements) {
        try {
          await sql(stmt);
          ok++;
        } catch (e: any) {
          // Ignorer les erreurs "already exists"
          if (
            e.message?.includes("already exists") ||
            e.message?.includes("duplicate") ||
            e.message?.includes("DuplicateObject")
          ) {
            skip++;
          } else {
            errors.push(`${file}: ${e.message?.substring(0, 100)}`);
          }
        }
      }
      results.push(`${file}: ${ok} OK, ${skip} skipped`);
    } catch (e: any) {
      errors.push(`${file}: ${e.message?.substring(0, 100)}`);
    }
  }

  return NextResponse.json({ results, errors, done: true });
}
