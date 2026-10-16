/**
 * GET /api/admin/ocr-debug?email=xxx&token=et-migrate-2025-prod
 *   → OCR brut + extraction_fields + re-extraction live pour tous les docs du user
 *
 * GET /api/admin/ocr-debug?email=xxx&token=et-migrate-2025-prod&docId=xxx
 *   → Idem mais pour un seul document
 *
 * Paramètres optionnels:
 *   &reextract=1  → Re-run extractAllBoxes() en live sur le texte OCR stocké (debug extraction)
 *   &rawOnly=1    → Retourner seulement le texte OCR brut (rapide)
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
  try {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  const docIdRaw = req.nextUrl.searchParams.get("docId");
  const reextract = req.nextUrl.searchParams.get("reextract") === "1";
  const rawOnly = req.nextUrl.searchParams.get("rawOnly") === "1";

  if (!email) return NextResponse.json({ error: "Paramètre email requis" }, { status: 400 });

  // Valider le format UUID si docId fourni (évite crash SQL sur "XXX" ou valeur invalide)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const docId = docIdRaw && UUID_RE.test(docIdRaw) ? docIdRaw : null;
  if (docIdRaw && !docId) {
    return NextResponse.json({
      error: "docId invalide — doit être un UUID (ex: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)",
      received: docIdRaw,
      hint: "Utilise l'URL sans &docId= pour lister tous tes documents et trouver le bon ID"
    }, { status: 400 });
  }

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
      LIMIT 20
    `;
  }

  // Import conditionnel de l'extracteur (seulement si reextract=1)
  let extractAllBoxes: ((text: string, slipCode: string) => unknown[]) | null = null;
  if (reextract) {
    try {
      const mod = await import("@/lib/ocr/dictionnaire");
      extractAllBoxes = mod.extractAllBoxes;
    } catch (e) {
      console.error("[ocr-debug] import extractAllBoxes failed:", e);
    }
  }

  const results = [];

  for (const doc of docsQuery as Row[]) {
    const dId = doc.id as string;
    const typeCode = (doc.type_code as string) ?? "T4A";

    // Pages OCR (texte brut)
    const pages = await sql`
      SELECT page_number, ocr_text
      FROM document_pages
      WHERE document_id = ${dId}
      ORDER BY page_number
    `;

    if (rawOnly) {
      results.push({
        docId: dId,
        filename: doc.original_filename,
        typeCode,
        pages: (pages as Row[]).map(p => ({
          pageNumber: p.page_number,
          ocrText: p.ocr_text,
        })),
      });
      continue;
    }

    // Extraction fields (valeurs stockées en DB)
    const extractions = await sql`
      SELECT de.id as extraction_id, de.tax_year,
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

    // Re-extraction live (debug extraction en temps réel)
    let liveExtraction: unknown[] | null = null;
    if (reextract && extractAllBoxes) {
      const allPageText = (pages as Row[])
        .map(p => p.ocr_text as string ?? "")
        .join("\n\n--- PAGE BREAK ---\n\n");
      try {
        liveExtraction = extractAllBoxes(allPageText, typeCode)
          .filter((b: unknown) => {
            const box = b as Record<string, unknown>;
            return box.rawValue !== null;
          });
      } catch (e) {
        liveExtraction = [{ error: String(e) }];
      }
    }

    const pagesData = (pages as Row[]).map(p => ({
      pageNumber: p.page_number,
      ocrTextPreview: (p.ocr_text as string)?.slice(0, 4000) ?? null,
      ocrTextLength: (p.ocr_text as string)?.length ?? 0,
      // 500 derniers chars = début page 2 instructions ?
      ocrTextTail: (p.ocr_text as string)?.length > 500
        ? (p.ocr_text as string).slice(-500)
        : null,
    }));

    results.push({
      docId: dId,
      filename: doc.original_filename,
      status: doc.status,
      typeCode,
      uploadedAt: doc.uploaded_at,
      pages: pagesData,
      extractionFields: extractions,
      incomeEntries,
      ...(reextract ? { liveExtraction } : {}),
    });
  }

  return NextResponse.json({
    email,
    userId,
    documentCount: results.length,
    reextractMode: reextract,
    documents: results,
  }, { status: 200 });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[ocr-debug] 500:", message, stack);
    return NextResponse.json({
      error: "Erreur interne",
      message,
      // Stack seulement en dev (pas en prod pour sécurité)
      ...(process.env.NODE_ENV !== "production" ? { stack } : {}),
    }, { status: 500 });
  }
}
