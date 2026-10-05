import type { ExtractedField, ExtractionResult } from "./base";

const MONEY = "(?:\\(?-?\\$?\\s*\\d{1,3}(?:[\\s,\\u00a0]\\d{3})*(?:[.,]\\d{2})\\)?|\\(?-?\\$?\\s*\\d+[.,]\\d{2}\\)?)";
const BOX_PATTERN = new RegExp(
  `(?:^|\\n)\\s*(?:box|case|case)\\s*(?:[-—:]\\s*)?([A-Z]{1,3}|\\d{1,3})\\b([^\\n]{0,170}?)(?:${MONEY})`,
  "gi",
);

function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Capture les cases visibles pour les documents du catalogue dont le schéma
 * fiscal détaillé n'est pas encore activé. Elles restent consultables, mais ne
 * sont jamais envoyées à Tax Engine sans mapping validé.
 */
export function extractVisibleUnknownFields(ocrText: string, taxYear?: number): ExtractionResult {
  const fields: ExtractedField[] = [];
  const seen = new Set<string>();
  for (const match of ocrText.matchAll(BOX_PATTERN)) {
    const rawCode = normalizeCode(match[1] ?? "");
    const context = (match[2] ?? "").replace(/\s+/g, " ").trim();
    const rawValue = match[0]?.match(new RegExp(`${MONEY}\\s*$`))?.[0]?.trim() ?? null;
    if (!rawCode || !rawValue || seen.has(`${rawCode}:${rawValue}`)) continue;
    seen.add(`${rawCode}:${rawValue}`);
    fields.push({
      fieldCode: `visible_box_${rawCode}`,
      fieldLabel: `Case ${rawCode}${context ? ` — ${context.slice(0, 130)}` : ""}`,
      rawOcrValue: rawValue,
      confidence: 70,
      needsReview: true,
      isRequired: false,
      pageNumber: 1,
    });
  }

  const detectedYear = ocrText.match(/\b(20(?:1[8-9]|2\d|30))\b/)?.[1];
  return {
    fields,
    overallConfidence: fields.length ? 70 : 0,
    needsHumanReview: true,
    yearMismatchWarning: Boolean(detectedYear && taxYear && Number(detectedYear) !== taxYear),
    detectedTaxYear: detectedYear ? Number(detectedYear) : taxYear ?? null,
    detectedJurisdictionCode: null,
  };
}
