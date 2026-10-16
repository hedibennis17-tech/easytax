/**
 * GET  /api/admin/user-cleanup?email=xxx&token=et-migrate-2025-prod
 *   → Diagnostique tous les documents + entrées income/deduction/credit d'un user
 *
 * POST /api/admin/user-cleanup?email=xxx&token=et-migrate-2025-prod&action=purge_entries
 *   → Supprime TOUTES les income/deduction/creditEntries du user (garde les documents)
 *
 * POST /api/admin/user-cleanup?email=xxx&token=et-migrate-2025-prod&action=purge_all
 *   → Supprime tout : documents + entrées (reset complet)
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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Paramètre email requis" }, { status: 400 });

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  // Trouver l'userId Clerk à partir de l'email
  const users = await sql.query(`
    SELECT DISTINCT fd.user_id
    FROM fiscal_documents fd
    JOIN users u ON fd.user_id = u.clerk_user_id
    WHERE u.email = $1
    LIMIT 1
  `, [email]).catch(() => ({ rows: [] }));

  // Fallback: chercher dans la table users directement
  const directUser = await sql.query(`
    SELECT clerk_user_id as user_id FROM users WHERE email = $1 LIMIT 1
  `, [email]).catch(() => ({ rows: [] }));

  const userId = (users.rows[0] as { user_id?: string })?.user_id
    ?? (directUser.rows[0] as { user_id?: string })?.user_id;

  if (!userId) {
    // Essai sans jointure users (cas où table users n'existe pas)
    return NextResponse.json({
      error: "Utilisateur introuvable",
      hint: "Vérifiez que la table users contient cet email, ou utilisez userId directement",
      email,
    }, { status: 404 });
  }

  // Documents
  const docs = await sql.query(`
    SELECT fd.id, fd.original_filename, fd.status, fd.created_at,
           dt.code as type_code,
           (SELECT COUNT(*) FROM income_entries ie WHERE ie.source_document_id = fd.id) as income_count,
           (SELECT COALESCE(SUM(amount_cents), 0) FROM income_entries ie WHERE ie.source_document_id = fd.id) as income_total_cents,
           (SELECT COUNT(*) FROM deduction_entries de WHERE de.source_document_id = fd.id) as deduction_count,
           (SELECT COUNT(*) FROM credit_entries ce WHERE ce.source_document_id = fd.id) as credit_count
    FROM fiscal_documents fd
    LEFT JOIN document_types dt ON fd.document_type_id = dt.id
    WHERE fd.user_id = $1 AND fd.deleted_at IS NULL
    ORDER BY fd.created_at DESC
  `, [userId]);

  // Totaux global
  const totals = await sql.query(`
    SELECT
      (SELECT COALESCE(SUM(amount_cents), 0) FROM income_entries WHERE user_id = $1) as total_income_cents,
      (SELECT COUNT(*) FROM income_entries WHERE user_id = $1) as income_rows,
      (SELECT COALESCE(SUM(amount_cents), 0) FROM deduction_entries WHERE user_id = $1) as total_deduction_cents,
      (SELECT COUNT(*) FROM deduction_entries WHERE user_id = $1) as deduction_rows,
      (SELECT COUNT(*) FROM credit_entries WHERE user_id = $1) as credit_rows
  `, [userId]);

  return NextResponse.json({
    email,
    userId,
    documents: docs.rows,
    totals: totals.rows[0],
    diagnostic: {
      totalDocuments: docs.rows.length,
      totalIncomeCAD: ((totals.rows[0] as { total_income_cents?: number })?.total_income_cents ?? 0) / 100,
      message: "Utilisez action=purge_entries pour reset les entrées sans supprimer les documents",
    },
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  const action = req.nextUrl.searchParams.get("action") ?? "purge_entries";

  if (!email) return NextResponse.json({ error: "Paramètre email requis" }, { status: 400 });
  if (!["purge_entries", "purge_all"].includes(action)) {
    return NextResponse.json({ error: "action doit être purge_entries ou purge_all" }, { status: 400 });
  }

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  // Trouver userId
  const directUser = await sql.query(`
    SELECT clerk_user_id as user_id FROM users WHERE email = $1 LIMIT 1
  `, [email]).catch(() => ({ rows: [] }));

  const userId = (directUser.rows[0] as { user_id?: string })?.user_id;
  if (!userId) return NextResponse.json({ error: "Utilisateur introuvable", email }, { status: 404 });

  const log: string[] = [];

  if (action === "purge_entries" || action === "purge_all") {
    const del1 = await sql.query(`DELETE FROM income_entries WHERE user_id = $1`, [userId]);
    const del2 = await sql.query(`DELETE FROM deduction_entries WHERE user_id = $1`, [userId]);
    const del3 = await sql.query(`DELETE FROM credit_entries WHERE user_id = $1`, [userId]);
    log.push(`income_entries supprimées: ${(del1 as unknown as { rowCount: number }).rowCount ?? "?"}`);
    log.push(`deduction_entries supprimées: ${(del2 as unknown as { rowCount: number }).rowCount ?? "?"}`);
    log.push(`credit_entries supprimées: ${(del3 as unknown as { rowCount: number }).rowCount ?? "?"}`);
  }

  if (action === "purge_all") {
    // Récupère les IDs des extractions liées aux docs du user
    const extractionIds = await sql.query(`
      SELECT de.id FROM document_extractions de
      JOIN fiscal_documents fd ON de.fiscal_document_id = fd.id
      WHERE fd.user_id = $1
    `, [userId]);
    const ids = (extractionIds.rows as { id: string }[]).map(r => r.id);

    if (ids.length > 0) {
      await sql.query(
        `DELETE FROM extraction_fields WHERE extraction_id = ANY($1::uuid[])`,
        [ids]
      );
      log.push(`extraction_fields supprimées pour ${ids.length} extractions`);
    }

    await sql.query(`
      DELETE FROM document_extractions WHERE fiscal_document_id IN (
        SELECT id FROM fiscal_documents WHERE user_id = $1
      )
    `, [userId]);
    log.push("document_extractions supprimées");

    await sql.query(`
      DELETE FROM document_pages WHERE document_id IN (
        SELECT id FROM fiscal_documents WHERE user_id = $1
      )
    `, [userId]);
    log.push("document_pages supprimées");

    await sql.query(`DELETE FROM fiscal_documents WHERE user_id = $1`, [userId]);
    log.push("fiscal_documents supprimés");
  }

  return NextResponse.json({ success: true, email, userId, action, log });
}
