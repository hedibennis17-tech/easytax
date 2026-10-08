/**
 * EasyTax Document Intelligence Engine — Template Registry
 *
 * Loads and caches all slip templates from the templates/ directory.
 * Used by the document classifier and field extractor.
 */

import fs from "fs";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FieldDef {
  type: "money" | "year" | "sin" | "reportCode" | "weeks" | "text";
  required: boolean;
  label_fr?: string;
  label_en?: string;
  t1_line?: string | null;
  tp1_line?: string | null;
  keywords_fr?: string[];
  keywords_en?: string[];
  mustNotMatch?: string[];
  allowed?: string[]; // for reportCode
}

export interface FiscalTarget {
  addTo?: string[];
  deductFrom?: string[];
}

export interface SlipTemplate {
  documentType: string;
  taxYear: number;
  authority: "federal" | "quebec";
  name_fr: string;
  name_en: string;
  anchors: string[];
  instructionsMarkers: string[];
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
