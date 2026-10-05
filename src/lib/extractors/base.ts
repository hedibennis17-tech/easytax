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

/**
 * Extraire une année fiscale imprimée. Les feuillets répètent l’année
 * d’imposition (champ « Année », pied de page, code du formulaire) alors que
 * les mentions d’autres années (redressements, rappels) sont rares : on
 * retient donc l’année la plus fréquente, pas la première rencontrée.
 */
export function extractYear(text: string): number | null {
  const years = text.match(/\b(20[12][0-9])\b/g)?.map(Number) ?? [];
  if (!years.length) return null;
  const counts = new Map<number, number>();
  for (const year of years) counts.set(year, (counts.get(year) ?? 0) + 1);
  let best = years[0];
  let bestCount = 0;
  for (const [year, count] of counts) {
    if (count > bestCount) {
      best = year;
      bestCount = count;
    }
  }
  return best;
}

/** Parser un montant monétaire vers des cents. */
export function parseMoney(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$\s,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : Math.round(num * 100);
}

/**
 * Les marqueurs EASYTAX_BOX sont produits uniquement à partir des tokens et
 * coordonnées Google Document AI. Ils sont une meilleure source que le texte
 * linéaire lorsque les colonnes d’un feuillet ont été réordonnées par l’OCR.
 * Le résultat reste toujours soumis à la confirmation du client.
 */
export function spatialBoxValue(ocrText: string, boxCode: string): string | null {
  const escaped = boxCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...ocrText.matchAll(new RegExp(`\\[EASYTAX_BOX\\s+code=0?${escaped}\\s+value=([^\\]]+)\\]`, "gi"))]
    .map(match => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  if (!matches.length) return null;
  // Plusieurs occurrences peuvent provenir de feuillets multiples : la plus
  // longue conserve les milliers + cents au lieu d’un fragment tronqué.
  return matches.sort((left, right) => right.replace(/\D/g, "").length - left.replace(/\D/g, "").length)[0];
}
