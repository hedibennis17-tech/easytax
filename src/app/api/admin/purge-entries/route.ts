/**
 * GET /api/admin/purge-entries?email=xxx&token=et-migrate-2025-prod
 *   → Supprime TOUTES les income/deduction/credit_entries du user (garde les documents)
 *
 * GET /api/admin/purge-entries?email=xxx&token=et-migrate-2025-prod&mode=all
 *   → Supprime tout (documents + extractions + entrées)
 *
 * Route GET volontaire pour faciliter l'appel depuis des outils qui ne supportent pas POST.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_TOKENS = ["et-migrate-2025-prod"];

function isAuthorized(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-migrate-token");
  const secret = process.env.MIGRATE_SECRET;
  return ALLOWED_TOKENS.includes(token ?? "") || (!!secret && token === secret);
}

type Row = Record<string, unknown>;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Paramètre email requis" }, { status: 400 });

  const mode = req.nextUrl.searchParams.get("mode") ?? "entries"; // "entries" ou "all"

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  // Trouver userId
  const userRows = await sql`SELECT clerk_user_id as user_id FROM users WHERE email = ${email} LIMIT 1`;
  const userId = (userRows[0] as Row | undefined)?.user_id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Utilisateur introuvable", email }, { status: 404 });

  const log: string[] = [];

  // Compter avant suppression
  const before = await sql`
    SELECT
      (SELECT COUNT(*) FROM income_entries WHERE user_id = ${userId}) as income,
      (SELECT COUNT(*) FROM deduction_entries WHERE user_id = ${userId}) as deductions,
      (SELECT COUNT(*) FROM credit_entries WHERE user_id = ${userId}) as credits
  `;
  const counts = before[0] as Row;
  log.push(`Avant: ${counts.income} income, ${counts.deductions} deductions, ${counts.credits} credits`);

  // Supprimer les entrées calculées
  const delIncome = await sql`DELETE FROM income_entries WHERE user_id = ${userId}`;
  const delDeduct = await sql`DELETE FROM deduction_entries WHERE user_id = ${userId}`;
  const delCredit = await sql`DELETE FROM credit_entries WHERE user_id = ${userId}`;
  log.push(`Supprimé: ${(delIncome as unknown as {count?: number}).count ?? "?"} income, ${(delDeduct as unknown as {count?: number}).count ?? "?"} deductions, ${(delCredit as unknown as {count?: number}).count ?? "?"} credits`);

  if (mode === "all") {
    // Extractions
    const extractionRows = await sql`
      SELECT de.id FROM document_extractions de
      JOIN fiscal_documents fd ON de.fiscal_document_id = fd.id
      WHERE fd.user_id = ${userId}
    `;
    const ids = (extractionRows as Row[]).map(r => r.id as string);

    if (ids.length > 0) {
      await sql`DELETE FROM extraction_fields WHERE extraction_id = ANY(${ids}::uuid[])`;
      log.push(`extraction_fields supprimées pour ${ids.length} extractions`);
    }

    await sql`DELETE FROM document_extractions WHERE fiscal_document_id IN (SELECT id FROM fiscal_documents WHERE user_id = ${userId})`;
    log.push("document_extractions supprimées");

    await sql`DELETE FROM document_pages WHERE document_id IN (SELECT id FROM fiscal_documents WHERE user_id = ${userId})`;
    log.push("document_pages supprimées");

    await sql`DELETE FROM fiscal_documents WHERE user_id = ${userId}`;
    log.push("fiscal_documents supprimés");
  }

  // Compter après
  const after = await sql`
    SELECT
      (SELECT COUNT(*) FROM income_entries WHERE user_id = ${userId}) as income,
      (SELECT COUNT(*) FROM deduction_entries WHERE user_id = ${userId}) as deductions,
      (SELECT COUNT(*) FROM credit_entries WHERE user_id = ${userId}) as credits
  `;
  const afterCounts = after[0] as Row;
  log.push(`Après: ${afterCounts.income} income, ${afterCounts.deductions} deductions, ${afterCounts.credits} credits`);

  return NextResponse.json({ success: true, email, userId, mode, log });
}
