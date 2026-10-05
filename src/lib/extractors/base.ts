/**
 * Interface abstraite DocumentExtractor
 * Chaque type de document (T4, RL-1, T5…) a son propre extracteur.
 */

export interface ExtractedField {
  fieldCode: string;     // ex: "box_14", "employer_name"
  fieldLabel: string;    // ex: "Case 14 — Revenus d'emploi"
  rawOcrValue: string | null;
  confidence: number;    // 0-100
  needsReview: boolean;
  isRequired: boolean;
  pageNumber?: number;
}

export interface ClassificationResult {
  documentTypeCode: string | null;  // "T4", "RL-1", null si inconnu
  confidence: number;               // 0-100
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

/**
 * Classifier générique — tente d'identifier le type de document
 * à partir du texte OCR brut.
 */
export function classifyDocument(ocrText: string): ClassificationResult {
  const text = ocrText.toUpperCase();

  // T4A doit être identifié avant T4 : « T4A » contient la chaîne « T4 ».
  // Les deux feuillets ont des cases et un traitement fiscal différents.
  if (
    text.includes("T4A") &&
    (text.includes("PENSION") || text.includes("RETRAITE") || text.includes("ANNUITY") || text.includes("HONORAIRES"))
  ) {
    return {
      documentTypeCode: "T4A",
      confidence: 95,
      reason: "Mots-clés T4A détectés (pension, retraite, rente ou honoraires)",
      detectedTaxYear: extractYear(ocrText),
      detectedJurisdictionCode: "CA",
    };
  }

  // T4 fédéral
  if (
    (text.includes("T4") && text.includes("STATEMENT OF REMUNERATION")) ||
    (text.includes("T4") && text.includes("ÉTAT DE LA RÉMUNÉRATION")) ||
    (text.includes("BOX 14") && text.includes("EMPLOYMENT INCOME")) ||
    (text.includes("CASE 14") && text.includes("REVENUS D'EMPLOI"))
  ) {
    return {
      documentTypeCode: "T4",
      confidence: 95,
      reason: "Mots-clés T4 détectés (Case 14, rémunération payée)",
      detectedTaxYear: extractYear(ocrText),
      detectedJurisdictionCode: "CA",
    };
  }

  // RL-1 Québec
  if (
    text.includes("RELEVÉ 1") ||
    text.includes("RL-1") ||
    text.includes("REVENUS D'EMPLOI ET REVENUS DIVERS") ||
    (text.includes("CASE A") && text.includes("REVENU D'EMPLOI"))
  ) {
    return {
      documentTypeCode: "RL-1",
      confidence: 92,
      reason: "Mots-clés RL-1 détectés (Relevé 1, Case A)",
      detectedTaxYear: extractYear(ocrText),
      detectedJurisdictionCode: "QC",
    };
  }

  // T5
  if (
    text.includes("T5") &&
    (text.includes("INVESTMENT INCOME") || text.includes("REVENUS DE PLACEMENT"))
  ) {
    return {
      documentTypeCode: "T5",
      confidence: 85,
      reason: "Mots-clés T5 détectés (revenus de placement)",
      detectedTaxYear: extractYear(ocrText),
      detectedJurisdictionCode: "CA",
    };
  }

  return {
    documentTypeCode: null,
    confidence: 0,
    reason: "Type de document non identifié",
    detectedTaxYear: extractYear(ocrText),
    detectedJurisdictionCode: null,
  };
}

/**
 * Extraire l'année fiscale du texte OCR
 */
export function extractYear(text: string): number | null {
  // Chercher une année entre 2018 et 2030
  const match = text.match(/\b(20[12][0-9])\b/);
  if (match) return parseInt(match[1]);
  return null;
}

/**
 * Parser un montant monétaire depuis le texte OCR
 * "52,400.00" → 5240000 (en cents)
 * "52 400,00" → 5240000
 */
export function parseMoney(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$\s,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100);
}
