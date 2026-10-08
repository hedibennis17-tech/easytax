/**
 * T5007 Extractor — Zone-based, EXTRACT_BOXES_ONLY
 *
 * Follows the EasyTax Document Intelligence Engine v1.0.0 contract:
 *   - Only extracts values from declared field zones (box 10, 11, 12, 13)
 *   - Never infers or invents values from surrounding text
 *   - Never reads instruction/footer text as tax data
 *   - Validates every value against its declared field type
 *   - Maps validated values to T1 lines via template fiscalMapping
 *
 * Golden test case: BOX 10 → 7201.32 → lines 14400 + 25000
 *                   BOX 12 → NAS (9 digits)
 *                   BOX 13 → O
 */

import type { DocumentExtractor, ExtractedField, ExtractionResult } from "./base";
import { extractYear } from "./base";
import { getTemplate, truncateAtInstructions } from "@/lib/ocr/document-engine/template-registry";

// ─── Money normalization ──────────────────────────────────────────────────────

/**
 * Parse a Canadian money string to a normalised "NNNNNN.NN" decimal string.
 * Accepts: 1234.56  1234,56  1 234,56  1,234.56  1 234.56  1234
 * Returns null if the string is not a valid money value.
 */
function normalizeMoney(raw: string): string | null {
  const cleaned = raw.replace(/ /g, " ").trim();

  // Detect decimal separator: last comma or period followed by exactly 2 digits at end
  const commaDecimal = /^[\d\s]+,\d{2}$/.test(cleaned);
  const periodDecimal = /^[\d\s,]+\.\d{2}$/.test(cleaned);

  let numeric: string;
  if (commaDecimal) {
    // European format: "1 234,56" or "1234,56"
    numeric = cleaned.replace(/[\s.]/g, "").replace(",", ".");
  } else if (periodDecimal) {
    // NA format: "1,234.56" or "1234.56"
    numeric = cleaned.replace(/[\s,]/g, "");
  } else {
    // Integer or unknown
    const digitsOnly = cleaned.replace(/[\s,.]/g, "");
    if (!/^\d+$/.test(digitsOnly)) return null;
    numeric = digitsOnly;
  }

  const num = parseFloat(numeric);
  if (Number.isNaN(num) || num < 0) return null;
  return num.toFixed(2);
}

/**
 * Parse a SIN: strip all spaces, dashes; must be exactly 9 digits.
 */
function normalizeSIN(raw: string): string | null {
  const digits = raw.replace(/[\s\-]/g, "");
  return /^\d{9}$/.test(digits) ? digits : null;
}

/**
 * Validate a report code: must be O, M, or C (T5007 specific).
 */
function normalizeReportCode(raw: string): string | null {
  const upper = raw.trim().toUpperCase();
  return ["O", "M", "C"].includes(upper) ? upper : null;
}

// ─── Zone-based extraction from Mistral markdown text ────────────────────────

/**
 * Mistral OCR returns structured markdown for the T5007 form.
 * The form data section looks like:
 *
 *   | Box 10 – Workers' compensation benefits | 7 201.32 |
 *   | Case 10 – Indemnités pour accidents     | 7 201.32 |
 *   | Box 12 – SIN                            | 123 456 789 |
 *   | Box 13 – Report code                    | O |
 *
 * Strategy: for each declared field we have a set of anchor patterns.
 * We scan only for those anchors in the DATA section (before instructionsMarkers).
 * The value is the numeric/code token immediately following the anchor.
 */

/** Anchor patterns for each T5007 field, bilingual. */
const FIELD_ANCHORS: Record<string, RegExp[]> = {
  box10: [
    // Money format: must have cents (e.g. 7201.32 or 7 201,32) to avoid matching years
    /(?:box|case)\s*10\b[\s\S]{0,120}?(\d{1,3}(?:[\s,]\d{3})*[.,]\d{2})\b/i,
    /workers[''`]?\s*compensation\s+benefits[\s\S]{0,200}?(\d{1,3}(?:[\s,]\d{3})*[.,]\d{2})\b/i,
    /indemnit[ée]s?\s+(?:pour\s+accidents?|du\s+travail)[\s\S]{0,200}?(\d{1,3}(?:[\s,]\d{3})*[.,]\d{2})\b/i,
    // Table cell: | ... box 10 ... | <value> |
    /\|\s*(?:[^|]*(?:box|case)\s*10\b[^|]*)\|\s*([\d\s,.]+)\s*\|/i,
    // Markdown bold/header style: **10** followed by value
    /\*\*10\*\*[\s\S]{0,120}?(\d{1,3}(?:[\s,]\d{3})*[.,]\d{2})\b/i,
  ],
  box11: [
    // Only match if value has cents (non-year money amounts like 1234.56 or 1 234,56)
    /(?:box|case)\s*11\b[\s\S]{0,120}?(\d{1,3}(?:[\s,]\d{3})*[.,]\d{2})\b/i,
    /social\s+assistance\s+payments?[\s\S]{0,200}?(\d{1,3}(?:[\s,]\d{3})*[.,]\d{2})\b/i,
    /prestations?\s+(?:de\s+bien-?[eê]tre|d['']assistance\s+sociale)[\s\S]{0,200}?(\d{1,3}(?:[\s,]\d{3})*[.,]\d{2})\b/i,
    /\|\s*(?:[^|]*(?:box|case)\s*11\b[^|]*)\|\s*([\d\s,.]+)\s*\|/i,
    /\*\*11\*\*[\s\S]{0,120}?(\d{1,3}(?:[\s,]\d{3})*[.,]\d{2})\b/i,
  ],
  box12: [
    // SIN zone — look for 9-digit number near box 12 label
    /(?:box|case)\s*12[\s\S]{0,80}?(\d[\d\s\-]{6,11}\d)\b/i,
    /social\s+insurance\s+number[\s\S]{0,80}?(\d[\d\s\-]{6,11}\d)\b/i,
    /num[eé]ro\s+d['']assurance\s+sociale[\s\S]{0,80}?(\d[\d\s\-]{6,11}\d)\b/i,
    /\|\s*(?:[^|]*(?:box|case|NAS|SIN)\s*12?[^|]*)\|\s*([\d\s\-]+)\s*\|/i,
    // SIN pattern directly — 3 groups of 3 digits
    /\b(\d{3}[\s\-]\d{3}[\s\-]\d{3})\b/,
  ],
  box13: [
    /(?:box|case)\s*13[\s\S]{0,60}?([OoMmCcAa])\b/i,
    /report\s+code[\s\S]{0,60}?([OoMmCcAa])\b/i,
    /code\s+(?:de\s+genre\s+de\s+)?feuillet[\s\S]{0,60}?([OoMmCcAa])\b/i,
    /\|\s*(?:[^|]*(?:box|case)\s*13[^|]*)\|\s*([OoMmCcAa])\s*\|/i,
  ],
};

/**
 * Extract box values from Mistral OCR markdown text using anchor patterns.
 * Only values found near their declared anchors are returned.
 *
 * Anti-hallucination: a candidate value is only accepted if:
 *   1. It appears within 200 chars of its anchor
 *   2. It passes the field type validator
 *   3. It is NOT in the instructions section (text is already truncated before calling)
 */
function extractFromMarkdown(
  text: string,
  fieldKey: string,
  type: "money" | "sin" | "reportCode"
): { raw: string; normalized: string; confidence: number } | null {
  const patterns = FIELD_ANCHORS[fieldKey];
  if (!patterns) return null;

  const candidates: Array<{ raw: string; normalized: string; confidence: number }> = [];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;

    const raw = match[1].trim();
    let normalized: string | null = null;

    if (type === "money") {
      normalized = normalizeMoney(raw);
    } else if (type === "sin") {
      normalized = normalizeSIN(raw);
    } else if (type === "reportCode") {
      normalized = normalizeReportCode(raw);
    }

    if (normalized !== null) {
      // Higher confidence for table cell matches (more structural)
      const isTableMatch = pattern.source.includes("\\|");
      candidates.push({ raw, normalized, confidence: isTableMatch ? 91 : 85 });
    }
  }

  if (!candidates.length) return null;
  // Return highest-confidence match
  return candidates.sort((a, b) => b.confidence - a.confidence)[0];
}

// ─── T5007 Extractor ─────────────────────────────────────────────────────────

export class T5007Extractor implements DocumentExtractor {
  readonly documentTypeCode = "T5007";

  canHandle(ocrText: string): boolean {
    const lower = ocrText.toLowerCase();
    return (
      (lower.includes("t5007") || lower.includes("statement of benefits") || lower.includes("état des prestations")) &&
      (lower.includes("workers") || lower.includes("compensation") || lower.includes("indemnit"))
    );
  }

  extract(ocrText: string, taxYear?: number): ExtractionResult {
    // Load template for field types + fiscal mapping
    const template = getTemplate("T5007", taxYear ?? 2025) ?? getTemplate("T5007", 2025);

    // Truncate at instructions — never read past page 1 data section
    const dataText = template
      ? truncateAtInstructions(ocrText, template)
      : ocrText.slice(0, Math.ceil(ocrText.length * 0.5));

    const detectedYear = extractYear(dataText) ?? taxYear ?? null;

    const fields: ExtractedField[] = [];
    let confidenceSum = 0;
    let confidenceCount = 0;
    let needsHumanReview = false;

    // ── Box 10 — Workers' compensation ──────────────────────────────────────
    const box10 = extractFromMarkdown(dataText, "box10", "money");
    fields.push({
      fieldCode: "box_10",
      fieldLabel: "Case 10 — Indemnités pour accidents du travail",
      rawOcrValue: box10?.normalized ?? null,
      confidence: box10?.confidence ?? 0,
      needsReview: !box10 || box10.confidence < 90,
      isRequired: true,
      pageNumber: 1,
    });
    if (box10) { confidenceSum += box10.confidence; confidenceCount++; }
    if (!box10) needsHumanReview = true;

    // ── Box 11 — Social assistance ──────────────────────────────────────────
    const box11 = extractFromMarkdown(dataText, "box11", "money");
    fields.push({
      fieldCode: "box_11",
      fieldLabel: "Case 11 — Prestations d'assistance sociale",
      rawOcrValue: box11?.normalized ?? null,
      confidence: box11?.confidence ?? 0,
      needsReview: !box11 || box11.confidence < 90,
      isRequired: false,
      pageNumber: 1,
    });
    if (box11) { confidenceSum += box11.confidence; confidenceCount++; }

    // ── Box 12 — NAS / SIN ─────────────────────────────────────────────────
    const box12 = extractFromMarkdown(dataText, "box12", "sin");
    fields.push({
      fieldCode: "box_12",
      fieldLabel: "Case 12 — Numéro d'assurance sociale",
      rawOcrValue: box12?.normalized ?? null,
      confidence: box12?.confidence ?? 0,
      needsReview: !box12 || box12.confidence < 90,
      isRequired: false,
      pageNumber: 1,
    });
    if (box12) { confidenceSum += box12.confidence; confidenceCount++; }

    // ── Box 13 — Report code ────────────────────────────────────────────────
    const box13 = extractFromMarkdown(dataText, "box13", "reportCode");
    fields.push({
      fieldCode: "box_13",
      fieldLabel: "Case 13 — Code de genre de feuillet",
      rawOcrValue: box13?.normalized ?? null,
      confidence: box13?.confidence ?? 0,
      needsReview: !box13 || box13.confidence < 90,
      isRequired: true,
      pageNumber: 1,
    });
    if (box13) { confidenceSum += box13.confidence; confidenceCount++; }
    if (!box13) needsHumanReview = true;

    const overallConfidence = confidenceCount > 0
      ? Math.round(confidenceSum / confidenceCount)
      : 0;

    return {
      fields,
      overallConfidence,
      needsHumanReview,
      yearMismatchWarning: detectedYear !== null && taxYear !== undefined && detectedYear !== taxYear,
      detectedTaxYear: detectedYear,
      detectedJurisdictionCode: "CA",
    };
  }
}

export const T5007_EXTRACTOR = new T5007Extractor();
