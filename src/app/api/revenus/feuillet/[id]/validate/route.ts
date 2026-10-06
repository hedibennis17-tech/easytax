import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { fiscalDocuments, documentExtractions, extractionFields } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { parseMontantOCR } from "@/lib/ocr/dictionnaire";

// POST /api/revenus/feuillet/[id]/validate
// Enregistre les corrections manuelles de l'user sur les cases OCR
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { edits } = await req.json() as { edits: Record<string, string> };
  const { id: documentId } = await params;

  // Vérifier ownership
  const [doc] = await db.select({ id: fiscalDocuments.id })
    .from(fiscalDocuments).where(and(eq(fiscalDocuments.id, documentId), eq(fiscalDocuments.userId, userId))).limit(1);
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const [extraction] = await db.select({ id: documentExtractions.id })
    .from(documentExtractions).where(eq(documentExtractions.fiscalDocumentId, documentId)).limit(1);
  if (!extraction) return NextResponse.json({ error: "Extraction introuvable" }, { status: 404 });

  // Mettre à jour les valeurs validées
  let updated = 0;
  for (const [code, value] of Object.entries(edits)) {
    const amountCents = parseMontantOCR(value);
    const candidates = [`box_${code}`, `case_${code}`, code];
    for (const candidate of candidates) {
      const [field] = await db.select({ id: extractionFields.id })
        .from(extractionFields)
        .where(and(eq(extractionFields.extractionId, extraction.id), eq(extractionFields.fieldCode, candidate)))
        .limit(1);
      if (field) {
        await db.update(extractionFields).set({
          validatedValue: value,
          updatedAt: new Date(),
        }).where(eq(extractionFields.id, field.id));
        updated++;
        break;
      }
    }
  }

  return NextResponse.json({ ok: true, updated });
}
