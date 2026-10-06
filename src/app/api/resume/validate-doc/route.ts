import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, taxReturns, incomeEntries, deductionEntries, creditEntries, fiscalDocuments, documentExtractions, documentTypes, documentPages } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { hasTaxMappingForDocumentType, syncOcrToEntries } from "@/lib/ocr-to-entries";

// POST /api/resume/validate-doc
// Marque isValidated=true sur toutes les entries issues d'un documentId spécifique.
// Déclenché quand l'utilisateur clique "Confirmer les données extraites".
export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { documentId } = await req.json() as { documentId: string };
  if (!documentId) return NextResponse.json({ error: "documentId requis" }, { status: 400 });

  const [profile] = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  const [taxReturn] = await db.select({ id: taxReturns.id })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);
  if (!taxReturn) return NextResponse.json({ error: "Aucun dossier fiscal" }, { status: 404 });

  const now = new Date();
  const [inc, ded, cred] = await Promise.all([
    db.update(incomeEntries).set({ isValidated: true, updatedAt: now })
      .where(and(eq(incomeEntries.userId, clerkUserId), eq(incomeEntries.sourceDocumentId, documentId)))
      .returning({ id: incomeEntries.id }),
    db.update(deductionEntries).set({ isValidated: true, updatedAt: now })
      .where(and(eq(deductionEntries.userId, clerkUserId), eq(deductionEntries.sourceDocumentId, documentId)))
      .returning({ id: deductionEntries.id }),
    db.update(creditEntries).set({ isValidated: true, updatedAt: now })
      .where(and(eq(creditEntries.userId, clerkUserId), eq(creditEntries.sourceDocumentId, documentId)))
      .returning({ id: creditEntries.id }),
  ]);

  // La confirmation doit aussi créer/réviser les entrées fiscales. Avant ce
  // resync, une correction OCR restait uniquement dans extractionFields et le
  // résumé Déclaration conservait l’ancien montant (ou zéro).
  const [source] = await db.select({
    extractionId: documentExtractions.id,
    typeCode: documentTypes.code,
  }).from(fiscalDocuments)
    .innerJoin(documentExtractions, eq(documentExtractions.fiscalDocumentId, fiscalDocuments.id))
    .leftJoin(documentTypes, eq(documentTypes.id, fiscalDocuments.documentTypeId))
    .where(and(eq(fiscalDocuments.id, documentId), eq(fiscalDocuments.userId, clerkUserId)))
    .limit(1);

  let sync = { created: 0, skipped: 0, errors: [] as string[] };
  if (source?.extractionId && source.typeCode && hasTaxMappingForDocumentType(source.typeCode)) {
    const [page] = await db.select({ ocrText: documentPages.ocrText })
      .from(documentPages).where(eq(documentPages.documentId, documentId)).limit(1);
    sync = await syncOcrToEntries({
      extractionId: source.extractionId,
      documentId,
      userId: clerkUserId,
      taxReturnId: taxReturn.id,
      documentTypeCode: source.typeCode,
      ocrText: page?.ocrText ?? undefined,
      replaceExisting: true,
    });
  }

  return NextResponse.json({
    ok: true,
    validated: { incomes: inc.length, deductions: ded.length, credits: cred.length },
    synced: sync,
  });
}
