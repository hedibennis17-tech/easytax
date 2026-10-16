/**
 * GET /api/admin/user-entries?email=xxx&token=et-migrate-2025-prod
 * Diagnostic détaillé: toutes les income_entries avec source, montant, isValidated
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_TOKENS = ["et-migrate-2025-prod"];

function isAuthorized(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-migrate-token");
  return ALLOWED_TOKENS.includes(token ?? "");
}

type Row = Record<string, unknown>;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email requis" }, { status: 400 });

  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);

  const userRows = await sql`SELECT clerk_user_id as user_id FROM users WHERE email = ${email} LIMIT 1`;
  const userId = (userRows[0] as Row | undefined)?.user_id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Introuvable", email }, { status: 404 });

  // Toutes les income entries avec détails
  const incomes = await sql`
    SELECT
      ie.id,
      ie.category,
      ie.amount_cents,
      ROUND(ie.amount_cents::numeric / 100, 2) as amount_cad,
      ie.is_validated,
      ie.description,
      ie.source_type,
      fd.original_filename,
      dt.code as doc_type,
      ie.created_at
    FROM income_entries ie
    LEFT JOIN fiscal_documents fd ON ie.source_document_id = fd.id
    LEFT JOIN document_types dt ON fd.document_type_id = dt.id
    WHERE ie.user_id = ${userId}
    ORDER BY ie.created_at DESC NULLS LAST
  `;

  // Total validé vs total brut
  const totals = await sql`
    SELECT
      COUNT(*) as total_count,
      ROUND(COALESCE(SUM(amount_cents), 0)::numeric / 100, 2) as total_all_cad,
      COUNT(*) FILTER (WHERE is_validated = true) as validated_count,
      ROUND(COALESCE(SUM(amount_cents) FILTER (WHERE is_validated = true), 0)::numeric / 100, 2) as total_validated_cad
    FROM income_entries WHERE user_id = ${userId}
  `;

  // Documents actifs
  const docs = await sql`
    SELECT fd.id, fd.original_filename, fd.status, dt.code
    FROM fiscal_documents fd
    LEFT JOIN document_types dt ON fd.document_type_id = dt.id
    WHERE fd.user_id = ${userId} AND fd.deleted_at IS NULL
    ORDER BY fd.uploaded_at DESC
  `;

  return NextResponse.json({
    email,
    userId,
    documents: docs,
    incomeEntries: incomes,
    totals: totals[0],
  });
}
