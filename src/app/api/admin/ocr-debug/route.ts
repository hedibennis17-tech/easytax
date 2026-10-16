/**
 * GET /api/admin/ocr-debug?email=xxx&token=et-migrate-2025-prod
 *   → Montre le texte OCR brut stocké + les extraction_fields pour tous les docs du user
 *
 * GET /api/admin/ocr-debug?email=xxx&token=et-migrate-2025-prod&docId=xxx
 *   → Idem mais pour un seul document
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

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
  const docId = req.nextUrl.searchParams.get("docId");

  if (!email) return NextResponse.json({ error: "Paramètre email requis" }, { status: 400 });

  const sql = neon(process.env.DATABASE_URL!);

  // Trouver userId
  const userRows = await sql`SELECT clerk_user_id as user_id FROM users WHERE email = ${email} LIMIT 1`;
  const userId = (userRows[0] as Row | undefined)?.user_id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Utilisateur introuvable", email }, { status: 404 });

  // Documents
  let docsQuery;
  if (docId) {
    docsQuery = await sql`
      SELECT fd.id, fd.original_filename, fd.status, fd.uploaded_at, dt.code as type_code
      FROM fiscal_documents fd
      LEFT JOIN document_types dt ON fd.document_type_id = dt.id
      WHERE fd.id = ${docId} AND fd.user_id = ${userId} AND fd.deleted_at IS NULL
    `;
  } else {
    docsQuery = await sql`
      SELECT fd.id, fd.original_filename, fd.status, fd.uploaded_at, dt.code as type_code
      FROM fiscal_documents fd
      LEFT JOIN document_types dt ON fd.document_type_id = dt.id
      WHERE fd.user_id = ${userId} AND fd.deleted_at IS NULL
      ORDER BY fd.uploaded_at DESC
    `;
  }

  const results = [];

  for (const doc of docsQuery as Row[]) {
    const dId = doc.id as string;

    // Pages OCR (texte brut)
    const pages = await sql`
      SELECT page_number, ocr_text, ocr_provider
      FROM document_pages
      WHERE document_id = ${dId}
      ORDER BY page_number
    `;

    // Extraction fields (valeurs extraites par le pipeline)
    const extractions = await sql`
      SELECT de.id as extraction_id, de.slip_type, de.tax_year,
             ef.field_code, ef.raw_value, ef.normalized_value, ef.confidence, ef.is_validated
      FROM document_extractions de
      JOIN extraction_fields ef ON ef.extraction_id = de.id
      WHERE de.fiscal_document_id = ${dId}
      ORDER BY ef.field_code
    `;

    // Income entries liées à ce doc
    const incomeEntries = await sql`
      SELECT category, label_fr, amount_cents, is_validated, source_box_code
      FROM income_entries
      WHERE source_document_id = ${dId}
      ORDER BY source_box_code
    `;

    results.push({
      docId: dId,
      filename: doc.original_filename,
      status: doc.status,
      typeCode: doc.type_code,
      uploadedAt: doc.uploaded_at,
      pages: (pages as Row[]).map(p => ({
        pageNumber: p.page_number,
        ocrProvider: p.ocr_provider,
        // Tronquer à 3000 chars pour la lisibilité — assez pour voir la page 1 complète
        ocrTextPreview: (p.ocr_text as string)?.slice(0, 3000) ?? null,
        ocrTextLength: (p.ocr_text as string)?.length ?? 0,
        // Montrer aussi les 500 derniers chars (fin du texte = début page 2?)
        ocrTextTail: (p.ocr_text as string)?.length > 500
          ? (p.ocr_text as string).slice(-500)
          : null,
      })),
      extractionFields: extractions,
      incomeEntries,
    });
  }

  return NextResponse.json({
    email,
    userId,
    documentCount: results.length,
    documents: results,
  }, { status: 200 });
}
