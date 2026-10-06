import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, taxReturns, fiscalDocuments, documentExtractions, extractionFields, documentPages, documentTypes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { extractAllBoxes, getSlipDict } from "@/lib/ocr/dictionnaire";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const url = new URL(req.url);
  const docId = url.searchParams.get("docId");

  const steps: string[] = [];
  const errors: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const details: Record<string, any> = {};

  // 1. Profil + TaxReturn
  const [profile] = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  const [tr] = profile
    ? await db.select({ id: taxReturns.id }).from(taxReturns)
        .where(eq(taxReturns.profileId, profile.id)).orderBy(desc(taxReturns.updatedAt)).limit(1)
    : [null];
  steps.push(`${profile ? "✓" : "✗"} Profil: ${profile?.id.slice(0,8) ?? "ABSENT"}`);
  steps.push(`${tr ? "✓" : "✗"} TaxReturn: ${tr?.id.slice(0,8) ?? "ABSENT"}`);

  // 2. Tous les documents
  const docs = await db.select({
    id: fiscalDocuments.id,
    status: fiscalDocuments.status,
    storageKey: fiscalDocuments.storageKey,
    taxReturnId: fiscalDocuments.taxReturnId,
    typeCode: documentTypes.code,
    typeName: documentTypes.labelFr,
  }).from(fiscalDocuments)
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(eq(fiscalDocuments.userId, userId))
    .orderBy(desc(fiscalDocuments.updatedAt));

  steps.push(`✓ Documents total: ${docs.length}`);

  // 3. Pour chaque document — diagnostic complet
  const docDiags = [];
  const targets = docId ? docs.filter(d => d.id.startsWith(docId)) : docs;

  for (const doc of targets) {
    const diag: Record<string, unknown> = {
      id: doc.id.slice(0,8),
      full_id: doc.id,
      status: doc.status,
      typeCode: doc.typeCode ?? "INCONNU",
      linkedToTR: doc.taxReturnId === tr?.id,
    };

    // Pages OCR
    const pages = await db.select({ ocrText: documentPages.ocrText, conf: documentPages.ocrConfidence, status: documentPages.ocrStatus, err: documentPages.ocrError })
      .from(documentPages).where(eq(documentPages.documentId, doc.id));
    diag.pagesCount = pages.length;
    diag.ocrTextLen = pages[0]?.ocrText?.length ?? 0;
    diag.ocrConf = pages[0]?.conf ?? 0;
    diag.ocrError = pages[0]?.err ?? null;

    // Extraction
    const [ext] = await db.select({ id: documentExtractions.id, status: documentExtractions.status, errorMessage: documentExtractions.errorMessage, confidence: documentExtractions.overallConfidence })
      .from(documentExtractions).where(eq(documentExtractions.fiscalDocumentId, doc.id)).limit(1);
    diag.extraction = ext ? { status: ext.status, conf: ext.confidence, error: ext.errorMessage } : "ABSENTE";

    // ExtractionFields
    const fields = ext ? await db.select({ code: extractionFields.fieldCode, value: extractionFields.rawOcrValue, conf: extractionFields.ocrConfidence })
      .from(extractionFields).where(eq(extractionFields.extractionId, ext.id)) : [];
    diag.fieldsCount = fields.length;
    diag.fields = fields.slice(0, 10);

    // Extraire les métadonnées du feuillet
    const { extractSlipMetadata } = await import("@/lib/ocr/dictionnaire");
    const meta = extractSlipMetadata(fullText);
    diag.metadata = meta;

    // Tester extractAllBoxes depuis le texte OCR
    const fullText = pages.map(p => p.ocrText ?? "").join("\n");
    const slipCode = doc.typeCode ?? "T4";
    const slipDef = getSlipDict(slipCode);
    diag.slipInDict = !!slipDef;
    diag.slipBoxesCount = slipDef?.boxes.length ?? 0;

    if (fullText.length > 0) {
      const boxes = extractAllBoxes(fullText, slipCode);
      const found = boxes.filter(b => b.rawValue && b.amountCents && b.amountCents > 0);
      diag.boxesExtracted = found.length;
      diag.boxesTotal = boxes.filter(b => !b.includedIn).length;
      diag.boxesSample = found.slice(0, 5).map(b => ({
        code: b.code, label: b.label_fr, value: b.rawValue,
        cents: b.amountCents, t1: b.t1_line, conf: b.confidence,
      }));

      if (found.length === 0 && fullText.length > 100) {
        errors.push(`Doc ${doc.id.slice(0,8)} (${slipCode}): OCR texte présent (${fullText.length} chars) mais 0 cases trouvées → keywords du dictionnaire ne matchent pas le texte`);
        // Afficher les 200 premiers chars pour voir le format
        diag.ocrTextSample = fullText.slice(0, 2000);  // Plus de texte pour debug
      }
    } else {
      errors.push(`Doc ${doc.id.slice(0,8)}: Pas de texte OCR en DB → pipeline pas déclenché ou S3 key not found`);
    }

    // Tester l'API /api/revenus/feuillet/[id]
    diag.apiUrl = `/api/revenus/feuillet/${doc.id}`;

    docDiags.push(diag);
  }

  details.documents = docDiags;

  // 4. Résumé
  const withText = docDiags.filter(d => (d.ocrTextLen as number) > 0);
  const withCases = docDiags.filter(d => (d.boxesExtracted as number) > 0);
  steps.push(`✓ Docs avec texte OCR: ${withText.length}/${docs.length}`);
  steps.push(`${withCases.length > 0 ? "✓" : "✗"} Docs avec cases extraites: ${withCases.length}/${docs.length}`);

  if (withCases.length === 0 && withText.length > 0) {
    errors.push("Le texte OCR existe mais le dictionnaire n'extrait rien → voir ocrTextSample pour comprendre le format");
  }

  return NextResponse.json({ ok: errors.length === 0, steps, errors, details });
}
