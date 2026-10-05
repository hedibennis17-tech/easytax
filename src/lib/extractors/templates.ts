import type { DocumentExtractor, ExtractedField, ExtractionResult } from "./base";
import { extractYear, spatialBoxValue } from "./base";

type FieldDefinition = {
  code: string;
  label: string;
  required?: boolean;
  boxCode?: string;
  labels: string[];
};

const MONEY = "([0-9]{1,3}(?:[\\s,\\u00a0][0-9]{3})*(?:[.,][0-9]{2}|\\s+[0-9]{2})|[0-9]+[.,][0-9]{2})";

function normalizeAmount(raw: string) {
  const compact = raw.replace(/\u00a0/g, " ").trim().replace(/\s+/g, " ");
  const splitCents = compact.match(/^([0-9]{1,3}(?:[, ]\d{3})+)\s+(\d{2})$/);
  if (splitCents) return `${splitCents[1].replace(/[, ]/g, "")}.${splitCents[2]}`;
  return compact.replace(/\s+/g, "");
}

function escape(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Gabarit pour les feuillets dont les cases sont standardisées. Une valeur ne
 * sort de ce gabarit que lorsqu’elle est soit liée géométriquement à sa case,
 * soit associée au libellé officiel bilingue. Les champs restent à valider dans
 * l’interface avant d’entrer dans le calcul fiscal.
 */
export class TemplateSlipExtractor implements DocumentExtractor {
  constructor(
    readonly documentTypeCode: string,
    private readonly anchors: RegExp,
    private readonly fields: FieldDefinition[],
    private readonly jurisdiction: string,
  ) {}

  canHandle(ocrText: string): boolean {
    return this.anchors.test(ocrText);
  }

  extract(ocrText: string, taxYear?: number): ExtractionResult {
    const extracted = this.fields.map(definition => this.extractField(ocrText, definition));
    const populated = extracted.filter(field => field.rawOcrValue);
    const detectedYear = extractYear(ocrText) ?? taxYear ?? null;
    return {
      fields: extracted,
      overallConfidence: populated.length
        ? Math.round(populated.reduce((total, field) => total + field.confidence, 0) / populated.length)
        : 0,
      needsHumanReview: true,
      yearMismatchWarning: detectedYear !== null && taxYear !== undefined && detectedYear !== taxYear,
      detectedTaxYear: detectedYear,
      detectedJurisdictionCode: this.jurisdiction,
    };
  }

  private extractField(ocrText: string, definition: FieldDefinition): ExtractedField {
    const candidates: Array<{ value: string; confidence: number }> = [];
    if (definition.boxCode) {
      const spatial = spatialBoxValue(ocrText, definition.boxCode);
      if (spatial) candidates.push({ value: spatial, confidence: 94 });
    }

    for (const label of definition.labels) {
      const labelPattern = escape(label).replace(/\s+/g, "\\s+");
      // Le montant peut être sur la même ligne, dans la cellule suivante ou
      // immédiatement sous le libellé, selon la version imprimée du feuillet.
      const pattern = new RegExp(`${labelPattern}(?:(?!\\b(?:box|case|bo[iî]te)\\s*[A-Z0-9]{1,3}\\b)[\\s\\S]){0,150}?${MONEY}`, "ig");
      for (const match of ocrText.matchAll(pattern)) {
        if (match[1]) candidates.push({ value: match[1], confidence: 82 });
      }
    }

    const selected = candidates
      .map(candidate => ({ ...candidate, value: normalizeAmount(candidate.value) }))
      .sort((left, right) => right.confidence - left.confidence || right.value.replace(/\D/g, "").length - left.value.replace(/\D/g, "").length)[0];

    return {
      fieldCode: definition.code,
      fieldLabel: definition.label,
      rawOcrValue: selected?.value ?? null,
      confidence: selected?.confidence ?? 0,
      needsReview: true,
      isRequired: Boolean(definition.required),
      pageNumber: 1,
    };
  }
}

// ARC T5 (25) — catégories officielles de revenu de placement.
export const T5_EXTRACTOR = new TemplateSlipExtractor(
  "T5",
  /\bT5\b[\s\S]{0,240}(?:STATEMENT\s+OF\s+INVESTMENT\s+INCOME|[ÉE]TAT\s+DES\s+REVENUS\s+DE\s+PLACEMENTS)/i,
  [
    { code: "box_10", boxCode: "10", label: "Case 10 — Dividendes non déterminés (montant réel)", labels: ["Actual amount of dividends other than eligible dividends", "Montant réel des dividendes autres que des dividendes déterminés"] },
    { code: "box_11", boxCode: "11", label: "Case 11 — Dividendes non déterminés (montant imposable)", required: true, labels: ["Taxable amount of dividends other than eligible dividends", "Montant imposable des dividendes autres que des dividendes déterminés"] },
    { code: "box_12", boxCode: "12", label: "Case 12 — Crédit de dividendes non déterminés", labels: ["Dividend tax credit for dividends other than eligible dividends", "Crédit d'impôt pour dividendes autres que des dividendes déterminés"] },
    { code: "box_13", boxCode: "13", label: "Case 13 — Intérêts de source canadienne", required: true, labels: ["Interest from Canadian sources", "Intérêts de source canadienne"] },
    { code: "box_15", boxCode: "15", label: "Case 15 — Revenus étrangers", labels: ["Foreign income", "Revenus étrangers"] },
    { code: "box_16", boxCode: "16", label: "Case 16 — Impôt étranger payé", labels: ["Foreign tax paid", "Impôt étranger payé"] },
    { code: "box_18", boxCode: "18", label: "Case 18 — Dividendes sur gains en capital", labels: ["Capital gains dividends", "Dividendes sur gains en capital"] },
    { code: "box_24", boxCode: "24", label: "Case 24 — Dividendes déterminés (montant réel)", labels: ["Actual amount of eligible dividends", "Montant réel des dividendes déterminés"] },
    { code: "box_25", boxCode: "25", label: "Case 25 — Dividendes déterminés (montant imposable)", required: true, labels: ["Taxable amount of eligible dividends", "Montant imposable des dividendes déterminés"] },
    { code: "box_26", boxCode: "26", label: "Case 26 — Crédit de dividendes déterminés", labels: ["Dividend tax credit for eligible dividends", "Crédit d'impôt pour dividendes déterminés"] },
  ],
  "CA",
);

// Relevé 1 Québec — aucune règle T4 n’est réutilisée : les lettres sont propres
// à Revenu Québec et restent dans leur gabarit dédié.
export const RL1_EXTRACTOR = new TemplateSlipExtractor(
  "RL-1",
  /(?:\bRL\s*[-–]?\s*1\b|\bRELEV[ÉE]\s*1\b)[\s\S]{0,300}(?:REVENUS\s+D['’]EMPLOI|EMPLOYMENT\s+INCOME|REVENU\s+D['’]EMPLOI)/i,
  [
    { code: "case_a", boxCode: "A", label: "Case A — Revenus d'emploi", required: true, labels: ["A - Revenus d'emploi", "A - Employment income", "Revenus d'emploi"] },
    { code: "case_b", boxCode: "B", label: "Case B — Cotisation au RRQ", labels: ["B - Cotisation au RRQ", "B - QPP contribution", "Cotisation au RRQ"] },
    { code: "case_c", boxCode: "C", label: "Case C — Cotisation au RQAP", labels: ["C - Cotisation au RQAP", "C - QPIP premium", "Cotisation au RQAP"] },
    { code: "case_e", boxCode: "E", label: "Case E — Impôt du Québec retenu", required: true, labels: ["E - Impôt du Québec retenu", "E - Québec income tax withheld", "Impôt du Québec retenu"] },
    { code: "case_j", boxCode: "J", label: "Case J — Cotisations syndicales", labels: ["J - Cotisations syndicales", "J - Union dues", "Cotisations syndicales"] },
  ],
  "QC",
);

export const T4E_EXTRACTOR = new TemplateSlipExtractor(
  "T4E",
  /\bT4E\b[\s\S]{0,240}(?:EMPLOYMENT\s+INSURANCE|ASSURANCE[- ]EMPLOI|[ÉE]TAT\s+DES\s+PRESTATIONS)/i,
  [
    { code: "box_14", boxCode: "14", label: "Case 14 — Prestations d'assurance-emploi", required: true, labels: ["Total benefits paid", "Prestations totales versées", "Employment insurance benefits"] },
    { code: "box_15", boxCode: "15", label: "Case 15 — Impôt sur le revenu retenu", labels: ["Income tax deducted", "Impôt sur le revenu retenu"] },
  ],
  "CA",
);

// T2202 : le montant de frais de scolarité n’est pas injecté avant validation.
// Il est distinct du nombre de mois à temps plein/partiel, qui n’est pas monétaire.
export const T2202_EXTRACTOR = new TemplateSlipExtractor(
  "T2202",
  /\bT2202\b[\s\S]{0,260}(?:TUITION\s+AND\s+ENROLMENT|FRAIS\s+DE\s+SCOLARIT[ÉE]\s+ET\s+D['’]INSCRIPTION)/i,
  [
    { code: "eligible_tuition", label: "Frais de scolarité admissibles", required: true, labels: ["Eligible tuition fees", "Frais de scolarité admissibles"] },
  ],
  "CA",
);

export const TEMPLATE_EXTRACTORS: DocumentExtractor[] = [
  T5_EXTRACTOR,
  RL1_EXTRACTOR,
  T4E_EXTRACTOR,
  T2202_EXTRACTOR,
];
