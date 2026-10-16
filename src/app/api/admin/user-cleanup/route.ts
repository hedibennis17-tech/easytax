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

type Row = Record<string, unknown>;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Paramètre email requis" }, { status: 400 });

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  // Trouver userId directement dans la table users
  const userRows = await sql`SELECT clerk_user_id as user_id FROM users WHERE email = ${email} LIMIT 1`;
  const userId = (userRows[0] as Row | undefined)?.user_id as string | undefined;

  if (!userId) {
    return NextResponse.json({
      error: "Utilisateur introuvable",
      hint: "Vérifiez l'email dans la table users",
      email,
    }, { status: 404 });
  }

  // Documents avec compteurs d'entrées par doc
  const docs = await sql`
    SELECT
      fd.id,
      fd.original_filename,
      fd.status,
      fd.uploaded_at,
      dt.code as type_code,
      (SELECT COUNT(*) FROM income_entries ie WHERE ie.source_document_id = fd.id) as income_count,
      (SELECT COALESCE(SUM(amount_cents), 0) FROM income_entries ie WHERE ie.source_document_id = fd.id) as income_total_cents,
      (SELECT COUNT(*) FROM deduction_entries de WHERE de.source_document_id = fd.id) as deduction_count,
      (SELECT COUNT(*) FROM credit_entries ce WHERE ce.source_document_id = fd.id) as credit_count
    FROM fiscal_documents fd
    LEFT JOIN document_types dt ON fd.document_type_id = dt.id
    WHERE fd.user_id = ${userId} AND fd.deleted_at IS NULL
    ORDER BY fd.uploaded_at DESC
  `;

  // Totaux globaux
  const totalsRows = await sql`
    SELECT
      (SELECT COALESCE(SUM(amount_cents), 0) FROM income_entries WHERE user_id = ${userId}) as total_income_cents,
      (SELECT COUNT(*) FROM income_entries WHERE user_id = ${userId}) as income_rows,
      (SELECT COALESCE(SUM(amount_cents), 0) FROM deduction_entries WHERE user_id = ${userId}) as total_deduction_cents,
      (SELECT COUNT(*) FROM deduction_entries WHERE user_id = ${userId}) as deduction_rows,
      (SELECT COUNT(*) FROM credit_entries WHERE user_id = ${userId}) as credit_rows
  `;
  const totals = totalsRows[0] as Row;

  return NextResponse.json({
    email,
    userId,
    documents: docs,
    totals,
    diagnostic: {
      totalDocuments: docs.length,
      totalIncomeCAD: (Number(totals?.total_income_cents ?? 0)) / 100,
      message: "POST ?action=purge_entries pour reset les entrées sans supprimer les documents",
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
  const userRows = await sql`SELECT clerk_user_id as user_id FROM users WHERE email = ${email} LIMIT 1`;
  const userId = (userRows[0] as Row | undefined)?.user_id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Utilisateur introuvable", email }, { status: 404 });

  const log: string[] = [];

  // Supprimer les entrées calculées
  await sql`DELETE FROM income_entries WHERE user_id = ${userId}`;
  await sql`DELETE FROM deduction_entries WHERE user_id = ${userId}`;
  await sql`DELETE FROM credit_entries WHERE user_id = ${userId}`;
  log.push("income_entries, deduction_entries, credit_entries supprimées");

  if (action === "purge_all") {
    // Récupère les IDs des extractions liées aux docs du user
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

    await sql`
      DELETE FROM document_extractions WHERE fiscal_document_id IN (
        SELECT id FROM fiscal_documents WHERE user_id = ${userId}
      )
    `;
    log.push("document_extractions supprimées");

    await sql`
      DELETE FROM document_pages WHERE document_id IN (
        SELECT id FROM fiscal_documents WHERE user_id = ${userId}
      )
    `;
    log.push("document_pages supprimées");

    await sql`DELETE FROM fiscal_documents WHERE user_id = ${userId}`;
    log.push("fiscal_documents supprimés");
  }

  return NextResponse.json({ success: true, email, userId, action, log });
}
