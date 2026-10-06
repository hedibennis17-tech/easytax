/**
 * universal.ts — Extracteur universel basé sur le dictionnaire OCR
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilise SLIP_DICT (28 feuillets, 368 cases) pour extraire les montants
 * depuis n'importe quel feuillet fiscal.
 *
 * Strategy: extractAllBoxes() du dictionnaire avec 4 stratégies de recherche:
 *   1. STRUCTURED FIELDS (Google Document AI — confiance 92%)
 *   2. Code explicite (box_14, case 14 — confiance 85%)
 *   3. Keywords FR (confiance 75%)
 *   4. Pattern tableau (confiance 70%)
 */
import type { DocumentExtractor, ExtractionResult, ExtractedField } from "./base";
import { extractYear } from "./base";
import { extractAllBoxes, getSlipDict, SLIP_DICT } from "@/lib/ocr/dictionnaire";

class UniversalSlipExtractor implements DocumentExtractor {
  constructor(readonly documentTypeCode: string) {}

  canHandle(ocrText: string): boolean {
    const slip = getSlipDict(this.documentTypeCode);
    if (!slip) return false;
    return slip.anchors.some(anchor =>
      ocrText.toLowerCase().includes(anchor.toLowerCase())
    );
  }

  extract(ocrText: string, taxYear?: number): ExtractionResult {
    const detectedYear = extractYear(ocrText) ?? taxYear ?? null;
    const boxes = extractAllBoxes(ocrText, this.documentTypeCode);

    const fields: ExtractedField[] = boxes
      .filter(box => !box.includedIn) // anti-double-comptage
      .map(box => ({
        fieldCode: `box_${box.code}`,
        fieldLabel: box.label_fr,
        rawOcrValue: box.rawValue ?? null,
        normalizedValue: box.amountCents ? String(box.amountCents / 100) : null,
        confidence: box.confidence,
        pageNumber: 1,
        needsReview: box.hasCondition || box.confidence < 80,
        isRequired: false,
        t1Line: box.t1_line ?? undefined,
        tp1Line: box.tp1_line ?? undefined,
      }));

    const populated = fields.filter(f => f.rawOcrValue);
    const overallConfidence = populated.length > 0
      ? Math.round(populated.reduce((s, f) => s + f.confidence, 0) / populated.length)
      : 0;

    return {
      fields,
      overallConfidence,
      needsHumanReview: populated.length === 0 || overallConfidence < 70,
      detectedTaxYear: detectedYear,
      yearMismatchWarning: detectedYear !== null && taxYear !== undefined && detectedYear !== taxYear,
      detectedJurisdictionCode: this.documentTypeCode.startsWith('RL-') ? 'QC' : null,
    };
  }
}

// Générer un extracteur pour chaque feuillet du dictionnaire
export const UNIVERSAL_EXTRACTORS: DocumentExtractor[] = SLIP_DICT.map(
  slip => new UniversalSlipExtractor(slip.code)
);
