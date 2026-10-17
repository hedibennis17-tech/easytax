/**
 * GET /api/admin/find-doc?token=et-migrate-2025-prod&userId=xxx
 *   → Liste TOUS les documents (actifs + supprimés) d'un utilisateur
 *
 * GET /api/admin/find-doc?token=et-migrate-2025-prod&docId=xxx
 *   → Cherche un doc spécifique (sans filtre deleted_at)
 *
 * GET /api/admin/find-doc?token=et-migrate-2025-prod&docId=xxx&restore=1
 *   → Restaure un document soft-deleted (remet deleted_at à NULL)
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_TOKENS = ["et-migrate-2025-prod"];

function isAuthorized(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-migrate-token");
  return ALLOWED_TOKENS.includes(token ?? "");
}

type Row = Record<string, unknown>;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const sql = neon(process.env.DATABASE_URL!);
  const userId = req.nextUrl.searchParams.get("userId");
  const docId = req.nextUrl.searchParams.get("docId");
  const restore = req.nextUrl.searchParams.get("restore") === "1";

  // Restaurer un doc supprimé
  if (docId && restore) {
    const result = await sql`
      UPDATE fiscal_documents
      SET deleted_at = NULL, status = 'uploaded', updated_at = NOW()
      WHERE id = ${docId}
      RETURNING id, original_filename, status, deleted_at, user_id
    ` as Row[];
    return NextResponse.json({ restored: result[0] ?? null });
  }

  // Chercher un doc spécifique par ID (sans filtre deleted_at)
  if (docId) {
    const doc = await sql`
      SELECT fd.id, fd.original_filename, fd.status, fd.uploaded_at, fd.deleted_at,
             dt.code as type_code, fd.user_id, fd.tax_return_id
      FROM fiscal_documents fd
      LEFT JOIN document_types dt ON fd.document_type_id = dt.id
      WHERE fd.id = ${docId}
    ` as Row[];
    return NextResponse.json({ doc: doc[0] ?? null });
  }

  // Lister tous les docs d'un userId (actifs + supprimés)
  if (userId) {
    const docs = await sql`
      SELECT fd.id, fd.original_filename, fd.status, fd.uploaded_at, fd.deleted_at,
             dt.code as type_code, fd.tax_return_id
      FROM fiscal_documents fd
      LEFT JOIN document_types dt ON fd.document_type_id = dt.id
      WHERE fd.user_id = ${userId}
      ORDER BY fd.uploaded_at DESC
    ` as Row[];
    return NextResponse.json({ userId, docs });
  }

  return NextResponse.json({ error: "Paramètre userId ou docId requis" }, { status: 400 });
}
