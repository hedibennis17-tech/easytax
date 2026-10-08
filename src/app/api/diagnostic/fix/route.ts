/**
 * POST /api/diagnostic/fix
 * Nettoie et corrige les données corrompues du questionnaire:
 * 1. Re-type les docs OTHER → bon type depuis le texte OCR
 * 2. Supprime les incomeEntries avec montants invalides
 * 3. Re-sync les docs T4/T4A avec le bon parseur
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, fiscalDocuments, documentTypes,
  documentExtractions, extractionFields, documentPages,
  incomeEntries, deductionEntries,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { classifySlip, extractAllBoxes, parseMontantOCR } from "@/lib/ocr/dictionnaire";
import { syncOcrToEntries } from "@/lib/ocr-to-entries";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const log: string[] = [];

  const [profile] = await db.select({ id: taxProfiles.id })
    .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [tr] = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);
  if (!tr) return NextResponse.json({ error: "TaxReturn introuvable" }, { status: 404 });

  // 1. Supprimer toutes les incomeEntries et deductionEntries existantes
  // pour repartir propre avec le bon parseur
  await db.delete(incomeEntries)
    .where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, tr.id)));
  await db.delete(deductionEntries)
    .where(and(eq(deductionEntries.userId, userId), eq(deductionEntries.taxReturnId, tr.id)));
  log.push(`Nettoyé: incomeEntries et deductionEntries supprimées`);

  // 2. Re-processer tous les documents depuis le texte OCR en DB
  const docs = await db.select({
    id: fiscalDocuments.id, status: fiscalDocuments.status, typeCode: documentTypes.code,
    taxReturnId: fiscalDocuments.taxReturnId,
  }).from(fiscalDocuments)
    .leftJoin(documentTypes, eq(fiscalDocuments.documentTypeId, documentTypes.id))
    .where(and(eq(fiscalDocuments.userId, userId), eq(fiscalDocuments.taxReturnId, tr.id)));

  for (const doc of docs) {
    const pages = await db.select({ ocrText: documentPages.ocrText })
      .from(documentPages).where(eq(documentPages.documentId, doc.id)).orderBy(documentPages.pageNumber);
    let fullText = pages.map(p => p.ocrText ?? "").join("\n");

    // Enrichir le texte OCR avec les champs structurés déjà en BD
    // (nécessaire pour les docs CRA Mon Dossier qui n'ont que l'en-tête dans ocrText)
    const [ext0] = await db.select({ id: documentExtractions.id })
      .from(documentExtractions).where(eq(documentExtractions.fiscalDocumentId, doc.id)).limit(1);
    if (ext0 && !fullText.includes("--- STRUCTURED FIELDS ---")) {
      const storedFields = await db.select({ fieldCode: extractionFields.fieldCode, rawOcrValue: extractionFields.rawOcrValue })
        .from(extractionFields).where(eq(extractionFields.extractionId, ext0.id));
      if (storedFields.length > 0) {
        fullText += "\n\n--- STRUCTURED FIELDS ---\n";
        for (const sf of storedFields) {
          if (sf.rawOcrValue) {
            // Nettoyer les valeurs corrompues : tronquer après 2 décimales (ex: "1482,6216" → "1482,62")
            const cleaned = sf.rawOcrValue.replace(/^([0-9\s,.']+[.,]\d{2})\d+$/, "$1");
            fullText += `${sf.fieldCode}: ${cleaned}\n`;
          }
        }
      }
    }

    if (!fullText || fullText.length < 50) {
      log.push(`Skip ${doc.id.slice(0,8)}: texte OCR trop court (${fullText.length} chars)`);
      continue;
    }

    // Détecter le vrai type
    const detectedCode = classifySlip(fullText) ?? doc.typeCode ?? "OTHER";
    if (detectedCode === "OTHER") {
      log.push(`Skip ${doc.id.slice(0,8)}: type non détectable`);
      continue;
    }

    // Mettre à jour le type si nécessaire
    if (detectedCode !== doc.typeCode) {
      const [dt] = await db.select({ id: documentTypes.id })
        .from(documentTypes).where(eq(documentTypes.code, detectedCode)).limit(1);
      if (dt) {
        await db.update(fiscalDocuments)
          .set({ documentTypeId: dt.id, status: "extracted", updatedAt: new Date() })
          .where(eq(fiscalDocuments.id, doc.id));
        log.push(`Type corrigé: ${doc.id.slice(0,8)} ${doc.typeCode ?? "OTHER"} → ${detectedCode}`);
      }
    }

    // Re-extraire les cases avec le bon parseur
    const boxes = extractAllBoxes(fullText, detectedCode);
    const validBoxes = boxes.filter(b => !b.includedIn && b.rawValue && parseMontantOCR(b.rawValue) !== null);

    if (validBoxes.length === 0) {
      log.push(`Skip ${doc.id.slice(0,8)} (${detectedCode}): 0 cases valides`);
      continue;
    }

    // Mettre à jour les extractionFields (réutilise ext0 déjà chargé)
    const ext = ext0;

    if (ext) {
      await db.delete(extractionFields).where(eq(extractionFields.extractionId, ext.id));
      for (const box of validBoxes) {
        await db.insert(extractionFields).values({
          extractionId: ext.id,
          fieldCode: `box_${box.code}`,
          fieldLabel: box.label_fr,
          rawOcrValue: box.rawValue,
          ocrConfidence: box.confidence,
          pageNumber: 1,
          needsReview: box.hasCondition,
          isRequired: false,
          validationStatus: "unreviewed",
        });
      }
      await db.update(documentExtractions).set({
        status: "completed", extractedAt: new Date(), updatedAt: new Date(),
        errorMessage: null, overallConfidence: Math.round(validBoxes.reduce((s,b) => s + b.confidence, 0) / validBoxes.length),
      }).where(eq(documentExtractions.id, ext.id));
    }

    // Sync → incomeEntries
    const sync = await syncOcrToEntries({
      extractionId: ext?.id ?? "",
      documentId: doc.id,
      userId,
      taxReturnId: tr.id,
      documentTypeCode: detectedCode,
      ocrText: fullText,
    });

    await db.update(fiscalDocuments)
      .set({ status: "extracted", updatedAt: new Date() })
      .where(eq(fiscalDocuments.id, doc.id));

    log.push(`✓ ${doc.id.slice(0,8)} (${detectedCode}): ${validBoxes.length} cases → ${sync.created} entrées créées`);
  }

  // Résumé
  const finalInc = await db.select({ amountCents: incomeEntries.amountCents, category: incomeEntries.category })
    .from(incomeEntries).where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, tr.id)));
  const total = finalInc.reduce((s, i) => s + (i.amountCents ?? 0), 0);

  return NextResponse.json({
    ok: true,
    log,
    result: {
      incomeEntries: finalInc.length,
      totalRevenus: (total / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) + " $",
      entries: finalInc.map(i => ({ cat: i.category, montant: ((i.amountCents ?? 0) / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2 }) + " $" })),
    },
  });
}

export async function GET() { return POST(); }
