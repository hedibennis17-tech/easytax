/**
 * GET /api/admin/reprocess-doc?docId=xxx&token=et-migrate-2025-prod
 *   → Re-déclenche le pipeline OCR complet sur un document existant (en tant qu'admin)
 *
 * Utilisé pour corriger les entrées après un fix OCR, sans re-uploader le fichier.
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED_TOKENS = ["et-migrate-2025-prod"];

function isAuthorized(req: NextRequest): boolean {
  const token = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-migrate-token");
  const secret = process.env.MIGRATE_SECRET;
  return ALLOWED_TOKENS.includes(token ?? "") || (!!secret && token === secret);
}

type Row = Record<string, unknown>;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const docId = req.nextUrl.searchParams.get("docId");
  if (!docId) return NextResponse.json({ error: "Paramètre docId requis" }, { status: 400 });

  const sql = neon(process.env.DATABASE_URL!);

  // Vérifier que le document existe et récupérer le userId
  const docRows = await sql`
    SELECT fd.id, fd.user_id, fd.original_filename, fd.status, dt.code as type_code
    FROM fiscal_documents fd
    LEFT JOIN document_types dt ON fd.document_type_id = dt.id
    WHERE fd.id = ${docId} AND fd.deleted_at IS NULL
  `;

  const doc = docRows[0] as Row | undefined;
  if (!doc) return NextResponse.json({ error: "Document introuvable", docId }, { status: 404 });

  const userId = doc.user_id as string;

  // Remettre le status en "uploaded" pour permettre le retraitement
  await sql`
    UPDATE fiscal_documents
    SET status = 'uploaded', updated_at = NOW()
    WHERE id = ${docId}
  `;

  // Supprimer les extractions existantes pour ce document (pour repartir propre)
  const extractionRows = await sql`
    SELECT id FROM document_extractions WHERE fiscal_document_id = ${docId}
  `;
  const extractionIds = (extractionRows as Row[]).map(r => r.id as string);

  if (extractionIds.length > 0) {
    await sql`DELETE FROM extraction_fields WHERE extraction_id = ANY(${extractionIds}::uuid[])`;
    await sql`DELETE FROM document_extractions WHERE fiscal_document_id = ${docId}`;
  }

  // Supprimer les document_pages pour forcer un re-OCR complet
  await sql`DELETE FROM document_pages WHERE document_id = ${docId}`;

  // Appeler le pipeline OCR via import dynamique
  const { runOcrPipeline } = await import("@/lib/pipeline");
  const result = await runOcrPipeline({
    documentId: docId,
    userId: userId,
    taxYear: 2025,
    selectedTypeCode: "AUTO",
  });

  return NextResponse.json({
    docId,
    filename: doc.original_filename,
    userId,
    previousStatus: doc.status,
    pipelineResult: result,
    extractionsDeleted: extractionIds.length,
  });
}
