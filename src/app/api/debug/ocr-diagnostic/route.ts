/**
 * GET /api/debug/ocr-diagnostic
 *
 * Diagnostic complet de l'extraction OCR pour TOUS les documents d'un dossier.
 * Montre :
 *   - Le texte OCR brut (premiers 800 chars)
 *   - La classification détectée
 *   - Ce que extractAllBoxes() retourne case par case pour le type détecté
 *   - Pourquoi une valeur est null (année rejetée, NAS rejeté, etc.)
 *   - La liste des entrées créées (income/deduction/credit)
 *
 * ⚠️ DEV ONLY
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns,
  incomeEntries, deductionEntries, creditEntries,
  fiscalDocuments, documentExtractions, extractionFields, documentTypes, documentPages,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { extractAllBoxes, parseMontantOCR } from "@/lib/ocr/dictionnaire";

function fmt(cents: number | null | undefined): string {
  if (!cents && cents !== 0) return "—";
  return (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " $";
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "DEV ONLY" }, { status: 403 });
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Résoudre le profil fiscal
  const [profile] = await db.select({ id: taxProfiles.id })
    .from(taxProfiles)
    .where(eq(taxProfiles.userId, clerkUserId))
    .limit(1);
  if (!profile) return NextResponse.json({ error: "Profil fiscal introuvable" }, { status: 404 });

  const [taxReturn] = await db.select({ id: taxReturns.id })
    .from(taxReturns)
    .where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.createdAt))
    .limit(1);

  // Charger tous les documents du profil
  const docs = await db.select({
    id: fiscalDocuments.id,
    originalName: fiscalDocuments.originalFilename,
    status: fiscalDocuments.status,
    taxReturnId: fiscalDocuments.taxReturnId,
    uploadedAt: fiscalDocuments.uploadedAt,
  })
    .from(fiscalDocuments)
    .where(eq(fiscalDocuments.userId, clerkUserId))
    .orderBy(desc(fiscalDocuments.uploadedAt));

  const results = [];

  for (const doc of docs) {
    // Texte OCR de la première page
    const [page] = await db.select({ ocrText: documentPages.ocrText, ocrConfidence: documentPages.ocrConfidence })
      .from(documentPages)
      .where(eq(documentPages.documentId, doc.id))
      .orderBy(documentPages.pageNumber)
      .limit(1);

    const ocrText = page?.ocrText ?? null;

    // Extraction enregistrée
    const [extraction] = await db.select({
      id: documentExtractions.id,
      detectedTaxYear: documentExtractions.detectedTaxYear,
      classificationConfidence: documentExtractions.classificationConfidence,
      classificationReason: documentExtractions.classificationReason,
      overallConfidence: documentExtractions.overallConfidence,
      needsHumanReview: documentExtractions.needsHumanReview,
      status: documentExtractions.status,
      errorMessage: documentExtractions.errorMessage,
    })
      .from(documentExtractions)
      .where(eq(documentExtractions.fiscalDocumentId, doc.id))
      .limit(1);

    // Champs extraits enregistrés
    const fields = extraction
      ? await db.select({
          fieldCode: extractionFields.fieldCode,
          fieldLabel: extractionFields.fieldLabel,
          rawOcrValue: extractionFields.rawOcrValue,
          ocrConfidence: extractionFields.ocrConfidence,
          needsReview: extractionFields.needsReview,
          validationStatus: extractionFields.validationStatus,
        })
          .from(extractionFields)
          .where(eq(extractionFields.extractionId, extraction.id))
      : [];

    // Type détecté
    const classificationReason = extraction?.classificationReason ?? "";
    const detectedTypeMatch = classificationReason.match(/\b(T4A?|T5007|T5|T3|RL-\d+|T4E|T2202|T4RSP)\b/i);
    const detectedType = detectedTypeMatch?.[1]?.toUpperCase() ?? null;

    // Simulation extractAllBoxes() avec le texte OCR actuel
    let simulatedBoxes: Array<{
      code: string;
      label: string;
      rawValue: string | null;
      amountCents: number | null;
      t1_line: string | null;
      tp1_line: string | null;
      status: string;
    }> = [];

    if (ocrText && detectedType) {
      try {
        const boxes = extractAllBoxes(ocrText, detectedType);
        simulatedBoxes = boxes.map(b => ({
          code: b.code,
          label: b.label_fr,
          rawValue: b.rawValue,
          amountCents: b.amountCents,
          t1_line: b.t1_line,
          tp1_line: b.tp1_line,
          status: b.amountCents !== null ? "✅ extrait" : b.rawValue ? "⚠️ brut_non_parsable" : "❌ non_trouvé",
        }));
      } catch (e) {
        simulatedBoxes = [{ code: "ERR", label: String(e), rawValue: null, amountCents: null, t1_line: null, tp1_line: null, status: "❌ erreur" }];
      }
    }

    // Test spécial parseMontantOCR sur des valeurs suspectes du texte
    const suspectValues: Array<{ raw: string; parsed: string }> = [];
    if (ocrText) {
      const candidates = ocrText.match(/\b(20[2-9]\d|[0-9]{9}|O|A|C)\b/g) ?? [];
      [...new Set(candidates)].slice(0, 10).forEach(raw => {
        const parsed = parseMontantOCR(raw);
        suspectValues.push({ raw, parsed: parsed !== null ? fmt(parsed) + " ← FAUX POSITIF !" : "rejeté ✅" });
      });
    }

    // Entrées créées pour ce document
    const incomes = await db.select({
      category: incomeEntries.category,
      amountCents: incomeEntries.amountCents,
      description: incomeEntries.description,
    })
      .from(incomeEntries)
      .where(and(
        eq(incomeEntries.userId, clerkUserId),
        eq(incomeEntries.sourceDocumentId, doc.id),
      ));

    const deductions = await db.select({
      category: deductionEntries.category,
      amountCents: deductionEntries.amountCents,
      description: deductionEntries.description,
    })
      .from(deductionEntries)
      .where(and(
        eq(deductionEntries.userId, clerkUserId),
        eq(deductionEntries.sourceDocumentId, doc.id),
      ));

    const credits = await db.select({
      category: creditEntries.category,
      claimedAmountCents: creditEntries.claimedAmountCents,
      description: creditEntries.description,
    })
      .from(creditEntries)
      .where(and(
        eq(creditEntries.userId, clerkUserId),
        eq(creditEntries.sourceDocumentId, doc.id),
      ));

    results.push({
      document: {
        id: doc.id,
        nom: doc.originalName,
        statut: doc.status,
        taxReturnId: doc.taxReturnId,
        lié_à_active_return: taxReturn ? doc.taxReturnId === taxReturn.id || !doc.taxReturnId : false,
        uploadé: doc.uploadedAt,
      },
      ocr: {
        disponible: Boolean(ocrText),
        confiance: page?.ocrConfidence ?? null,
        extrait_preview: ocrText ? ocrText.slice(0, 800) : null,
      },
      classification: extraction ? {
        type_détecté: detectedType,
        année: extraction.detectedTaxYear,
        confiance: extraction.classificationConfidence,
        raison: extraction.classificationReason,
        statut: extraction.status,
        review_requis: extraction.needsHumanReview,
        erreur: extraction.errorMessage,
      } : { statut: "aucune_extraction" },
      champs_extraits_en_bd: fields.map(f => ({
        code: f.fieldCode,
        label: f.fieldLabel,
        valeur_ocr: f.rawOcrValue,
        statut_validation: f.validationStatus,
        review: f.needsReview,
      })),
      simulation_extractAllBoxes: {
        type: detectedType,
        boxes: simulatedBoxes,
        note: "Simulation avec le texte OCR actuel + code actuel (post-fix)",
      },
      valeurs_suspectes_testées: suspectValues,
      entrées_créées: {
        revenus: incomes.map(i => ({ cat: i.category, montant: fmt(i.amountCents), desc: i.description })),
        déductions: deductions.map(d => ({ cat: d.category, montant: fmt(d.amountCents), desc: d.description })),
        crédits: credits.map(c => ({ cat: c.category, montant: fmt(c.claimedAmountCents), desc: c.description })),
        total: incomes.length + deductions.length + credits.length,
      },
    });
  }

  return NextResponse.json({
    profil_id: profile.id,
    déclaration_active: taxReturn?.id ?? null,
    documents: results,
    _note: "DEV ONLY — supprimer avant prod",
  }, { status: 200 });
}
