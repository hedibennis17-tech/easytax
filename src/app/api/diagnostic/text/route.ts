/**
 * GET /api/diagnostic/text?docId=<id>
 * Retourne le texte OCR brut stocké en DB + le résultat de classification.
 * Utile pour diagnostiquer pourquoi 0 champs sont extraits.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentPages, documentExtractions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { classifyTaxDocument } from "@/lib/document-intelligence/catalog";
import { guardSelectedDocumentType } from "@/lib/document-intelligence/catalog";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const url = new URL(req.url);
  const docId = url.searchParams.get("docId");

  const docs = await db.select({ id: fiscalDocuments.id, status: fiscalDocuments.status })
    .from(fiscalDocuments)
    .where(eq(fiscalDocuments.userId, userId))
    .orderBy(desc(fiscalDocuments.updatedAt))
    .limit(10);

  const target = docId
    ? docs.find(d => d.id === docId || d.id.startsWith(docId))
    : docs[0];

  if (!target) return NextResponse.json({ error: "Aucun document trouvé" }, { status: 404 });

  const pages = await db.select({ pageNumber: documentPages.pageNumber, ocrText: documentPages.ocrText, ocrStatus: documentPages.ocrStatus })
    .from(documentPages)
    .where(eq(documentPages.documentId, target.id));

  const [ext] = await db.select({ status: documentExtractions.status, ocrProvider: documentExtractions.ocrProvider, classificationReason: documentExtractions.classificationReason, errorMessage: documentExtractions.errorMessage })
    .from(documentExtractions)
    .where(eq(documentExtractions.fiscalDocumentId, target.id))
    .limit(1);

  const fullText = pages.map(p => p.ocrText ?? "").join("\n\n");
  const classification = classifyTaxDocument(fullText);
  const guard = guardSelectedDocumentType(undefined, classification);

  return NextResponse.json({
    docId: target.id,
    status: target.status,
    extraction: ext ?? null,
    classification,
    guard,
    textLength: fullText.length,
    // Premiers 2000 chars du texte OCR pour diagnostic
    textPreview: fullText.slice(0, 2000),
    // Lignes contenant "T4A" ou anchors clés
    anchorLines: fullText.split("\n").filter(line =>
      /T4A|pension|retraite|rente|État|Etat/i.test(line)
    ).slice(0, 20),
  });
}
