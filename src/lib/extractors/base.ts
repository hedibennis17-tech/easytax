import { classifyTaxDocument } from "@/lib/document-intelligence/catalog";

/**
 * Interface abstraite DocumentExtractor.
 * Chaque type de document possède un extracteur fiscal détaillé optionnel.
 */
export interface ExtractedField {
  fieldCode: string;
  fieldLabel: string;
  rawOcrValue: string | null;
  confidence: number;
  needsReview: boolean;
  isRequired: boolean;
  pageNumber?: number;
}

export interface ClassificationResult {
  documentTypeCode: string | null;
  confidence: number;
  reason: string;
  detectedTaxYear: number | null;
  detectedJurisdictionCode: string | null;
}

export interface ExtractionResult {
  fields: ExtractedField[];
  overallConfidence: number;
  needsHumanReview: boolean;
  yearMismatchWarning: boolean;
  detectedTaxYear: number | null;
  detectedJurisdictionCode: string | null;
}

export interface DocumentExtractor {
  readonly documentTypeCode: string;
  canHandle(ocrText: string): boolean;
  extract(ocrText: string, taxYear?: number): ExtractionResult;
}

/** Classificateur rétrocompatible : le catalogue pancanadien est la source unique. */
export function classifyDocument(ocrText: string): ClassificationResult {
  const classification = classifyTaxDocument(ocrText);
  return {
    documentTypeCode: classification.documentTypeCode,
    confidence: classification.confidence,
    reason: classification.reason,
    detectedTaxYear: classification.detectedTaxYear,
    detectedJurisdictionCode: classification.detectedJurisdictionCode,
  };
}

/** Extraire une année fiscale imprimée. */
export function extractYear(text: string): number | null {
  const match = text.match(/\b(20[12][0-9])\b/);
  return match ? parseInt(match[1], 10) : null;
}

/** Parser un montant monétaire vers des cents. */
export function parseMoney(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$\s,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : Math.round(num * 100);
}
