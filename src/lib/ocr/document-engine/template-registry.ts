/**
 * EasyTax Document Intelligence Engine — Template Registry
 *
 * Loads and caches all slip templates from the templates/ directory.
 * Used by the document classifier and field extractor.
 *
 * v2: Adds zone-based extraction support (EXTRACT_BOXES_ONLY architecture).
 */

import fs from "fs";
import path from "path";

// ─── Zone types ───────────────────────────────────────────────────────────────

export type OcrMode =
  | "SINGLE_LINE"
  | "MULTI_LINE"
  | "NUMERIC_ONLY"
  | "ALPHANUMERIC"
  | "CODE_ONLY";

/**
 * Normalized 0-to-1 bounding box for a field on the document page.
 * Coordinates are relative to the page dimensions (width=1, height=1).
 */
export interface ZoneDef {
  id: string;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  ocrMode: OcrMode;
  fieldId: string;
}

// ─── Field types ──────────────────────────────────────────────────────────────

export type FieldType =
  | "money"
  | "MONEY"
  | "year"
  | "YEAR"
  | "sin"
  | "SIN"
  | "reportCode"
  | "REPORT_CODE"
  | "weeks"
  | "text"
  | "TEXT";

export interface FieldValidation {
  mustBeNumeric?: boolean;
  mustContainExactlyNineDigits?: boolean;
  mustEqualDocumentTaxYear?: boolean;
  allowed?: string[];
  min?: number;
  max?: number;
}

export interface TaxMapping {
  add?: string[];
  deduct?: string[];
  /** Quebec-specific */
  addTo?: string[];
  deductFrom?: string[];
  verifyOfficialMapping?: boolean;
}

/**
 * v2 field definition — zone-based, strict.
 */
export interface FieldDef {
  fieldId?: string;
  boxNumber?: string | null;
  type: FieldType;
  required: boolean;
  extract?: boolean;
  zone?: string;                         // zone id in template.zones
  normalize?: string;
  label_fr?: string;
  label_en?: string;
  /** @deprecated use taxMapping instead */
  t1_line?: string | null;
  tp1_line?: string | null;
  /** @deprecated use taxMapping instead */
  keywords_fr?: string[];
  /** @deprecated use taxMapping instead */
  keywords_en?: string[];
  mustNotMatch?: string[];
  allowed?: string[];
  validation?: FieldValidation;
  taxMapping?: {
    federal?: TaxMapping;
    quebec?: TaxMapping;
  } | TaxMapping[];
}

export interface FiscalTarget {
  addTo?: string[];
  deductFrom?: string[];
}

/**
 * Slip template — v2 adds zones and strict field contracts.
 * Backward-compatible with v1 keyword-based templates.
 */
export interface SlipTemplate {
  documentType: string;
  taxYear: number;
  authority: "federal" | "quebec";
  templateVersion?: string;
  engineVersion?: string;
  name_fr: string;
  name_en: string;
  source?: string;
  anchors: string[];
  instructionsMarkers: string[];
  extractionPolicy?: "BOXES_ONLY" | "FULL_PAGE";
  ignoredAreas?: string[];

  /** Zone definitions (v2). Key = zone id. */
  zones?: Record<string, ZoneDef>;

  fields: Record<string, FieldDef>;
  fiscalMapping: Record<string, { federal?: FiscalTarget; quebec?: FiscalTarget }>;
  validationRules?: Record<string, {
    min?: number;
    max?: number;
    max_pct_of?: string;
    max_pct?: number;
  }>;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const TEMPLATES_DIR = path.join(__dirname, "templates");
const _cache = new Map<string, SlipTemplate>();

function templateKey(docType: string, year: number): string {
  return `${docType}-${year}`;
}

/**
 * Load a template from the registry.
 * Returns null if no template found for this document type + year.
 */
export function getTemplate(docType: string, year: number): SlipTemplate | null {
  const key = templateKey(docType, year);
  if (_cache.has(key)) return _cache.get(key)!;

  const filePath = path.join(TEMPLATES_DIR, `${docType}-${year}.json`);
  if (!fs.existsSync(filePath)) return null;

  const template = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SlipTemplate;
  _cache.set(key, template);
  return template;
}

/**
 * List all available templates (docType + year pairs).
 */
export function listTemplates(): Array<{ docType: string; year: number }> {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs
    .readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const match = f.match(/^(.+)-(\d{4})\.json$/);
      if (!match) return null;
      return { docType: match[1], year: parseInt(match[2]) };
    })
    .filter((x): x is { docType: string; year: number } => x !== null);
}

/**
 * Detect which slip type a piece of OCR text belongs to.
 * Tries the most recent year first, then falls back.
 *
 * Returns null if no template matches.
 */
export function classifyDocument(
  ocrText: string,
  candidateYear = new Date().getFullYear()
): SlipTemplate | null {
  const all = listTemplates().sort((a, b) => b.year - a.year);

  // Full anchor match (all anchors present)
  for (const { docType, year } of all) {
    if (year > candidateYear) continue;
    const template = getTemplate(docType, year);
    if (!template) continue;

    const lower = ocrText.toLowerCase();
    const matched = template.anchors.every(
      (anchor) => lower.includes(anchor.toLowerCase())
    );
    if (matched) return template;
  }

  // Partial match fallback: any anchor matches
  for (const { docType, year } of all) {
    if (year > candidateYear) continue;
    const template = getTemplate(docType, year);
    if (!template) continue;

    const lower = ocrText.toLowerCase();
    const anyMatch = template.anchors.some((anchor) =>
      lower.includes(anchor.toLowerCase())
    );
    if (anyMatch) return template;
  }

  return null;
}

/**
 * Truncate OCR text at the instructions page markers defined in the template.
 * Prevents page 2 CRA/Revenu Québec instructions from being read as data.
 */
export function truncateAtInstructions(
  ocrText: string,
  template: SlipTemplate
): string {
  for (const marker of template.instructionsMarkers) {
    const idx = ocrText.indexOf(marker);
    if (idx > 200) {
      return ocrText.slice(0, idx);
    }
  }
  return ocrText;
}

/**
 * Returns true if this template uses the new zone-based extraction architecture.
 */
export function isZoneBasedTemplate(template: SlipTemplate): boolean {
  return (
    template.extractionPolicy === "BOXES_ONLY" &&
    template.zones != null &&
    Object.keys(template.zones).length > 0
  );
}

/**
 * Get all field definitions that have an associated zone (v2 templates).
 */
export function getZonedFields(
  template: SlipTemplate
): Array<{ fieldKey: string; field: FieldDef; zone: ZoneDef }> {
  if (!template.zones) return [];
  const result: Array<{ fieldKey: string; field: FieldDef; zone: ZoneDef }> = [];

  for (const [fieldKey, field] of Object.entries(template.fields)) {
    if (!field.zone) continue;
    const zone = template.zones[field.zone];
    if (!zone) continue;
    result.push({ fieldKey, field, zone });
  }

  return result;
}
