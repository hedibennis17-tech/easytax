/**
 * dictionnaire.ts — v2025.2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Généré depuis: Dictionnaire_fiscal_complet_2025.json
 * Source: ARC (guides RC4120, RC4157, T4079, T4015) + Revenu Québec (guides officiels)
 * 28 feuillets · 368 cases · 104 lignes T1 · 89 lignes TP-1 · 13 provinces
 *
 * CHAMPS CRITIQUES:
 *   included_in       → case déjà comptée dans une autre (anti-double-comptage)
 *   t1_line_condition → mapping conditionnel (âge, type de revenu, etc.)
 *   auto_deduction_line → déduction automatique (T5007→25000, RL-5→295)
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BoxDef {
  code: string;
  label_fr: string;
  label_en?: string;
  t1_line: string | null;
  tp1_line: string | null;
  data_type: "money" | "text" | "number" | "date" | "code" | "boolean" | "year";
  keywords_fr: string[];
  keywords_en: string[];
  notes?: string;
  included_in?: string | null;          // code de la case parente (ne pas additionner)
  t1_line_condition?: string | null;    // mapping conditionnel T1
  auto_deduction_line?: string | null;  // ligne de déduction automatique
  label_source?: string;                // "arc_fr" | "rq_fr" | "translation"
}

export interface SlipDef {
  code: string;
  name_fr: string;
  name_en: string;
  authority: "federal" | "provincial";
  province?: string | null;
  anchors: string[];
  boxes: BoxDef[];
}

export interface T1LineDef {
  label_fr: string;
  label_en?: string;
  section: "revenus" | "deductions" | "credits" | "total" | "withheld" | "other";
  bold?: boolean;
}

export interface TP1LineDef {
  label_fr: string;
  section: string;
}

export interface ProvinceDef {
  code: string;
  name_fr: string;
  name_en: string;
  form: string;
  bpa_2025: number;
  brackets: Array<{ up_to: number; rate: number }>;
  top_rate: number;
  notes: string;
}

// ── Chargement dynamique depuis le JSON ──────────────────────────────────────
// On charge le JSON une seule fois au démarrage du module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _raw = require("./dictionnaire-fiscal-complet-2025.json") as {
  slips: SlipDef[];
  t1_lines: Record<string, Omit<T1LineDef, "bold">>;
  tp1_lines: Record<string, Omit<TP1LineDef, "section"> & { section: string }>;
  provinces: ProvinceDef[];
  segmentation_rules: string[];
  money_patterns: { fr: string; note: string; table_row: string; normalize: string };
};

// ── Exports ───────────────────────────────────────────────────────────────────
export const SLIP_DICT: SlipDef[] = _raw.slips;
export const T1_DICT:  Record<string, T1LineDef>  = _raw.t1_lines  as Record<string, T1LineDef>;
export const TP1_DICT: Record<string, TP1LineDef> = _raw.tp1_lines as Record<string, TP1LineDef>;
export const PROVINCE_DICT: ProvinceDef[] = _raw.provinces;
export const SEGMENTATION_RULES: string[] = _raw.segmentation_rules;

// ── Helpers de lookup ─────────────────────────────────────────────────────────
export function getSlipDict(slipCode: string): SlipDef | null {
  return SLIP_DICT.find(s => s.code === slipCode) ?? null;
}

export function getBoxDef(slipCode: string, boxCode: string): BoxDef | null {
  return getSlipDict(slipCode)?.boxes.find(b => b.code === boxCode) ?? null;
}

export function getProvinceDef(provinceCode: string): ProvinceDef | null {
  return PROVINCE_DICT.find(p => p.code === provinceCode) ?? null;
}

/** Toutes les boxes d'un feuillet qui ne sont pas incluses dans une autre */
export function getPrimaryBoxes(slipCode: string): BoxDef[] {
  return (getSlipDict(slipCode)?.boxes ?? []).filter(b => !b.included_in);
}

/** Boxes à mapper vers T1 (money, non incluses ailleurs) */
export function getMappableBoxes(slipCode: string): BoxDef[] {
  return getPrimaryBoxes(slipCode).filter(b =>
    b.data_type === "money" && (b.t1_line || b.tp1_line)
  );
}

// ── Normalisation montants ────────────────────────────────────────────────────
/**
 * Normalise un montant OCR → centimes (integer)
 * « 7 201,32 » → 720132
 * « 7,201.32 » → 720132
 * « 52000 »    → 5200000
 * Règle anti-absorption: évite « 024 048 » → 24.04$
 */
export function parseMontantOCR(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  let s = raw.replace(/[$€¥£\u00a0\s]/g, "");
  // Détecter format FR (virgule décimale) vs EN (point décimal)
  const hasCommaDecimal = /\d,\d{2}$/.test(s) && !s.includes(".");
  if (hasCommaDecimal) {
    s = s.replace(/\s/g, "").replace(",", ".");
  } else {
    s = s.replace(/,(?=\d{3})/g, "").replace(",", ".");
  }
  // Rejeter si plus de 2 décimales (ex: "1580,8016" = deux montants collés)
  if (/[.,]\d{3,}/.test(raw.replace(/\s/g, ""))) return null;
  // Rejeter les codes de cases (ex: "024" sans décimale et < 5 chiffres)
  if (/^\d{1,4}$/.test(s) && !s.includes(".")) return null;
  const num = parseFloat(s);
  // Rejeter < 1$ (codes de cases qui passent la regex) et > 9 999 999$
  if (isNaN(num) || num < 1 || num > 9_999_999) return null;
  return Math.round(num * 100);
}

// ── Recherche de valeur dans le texte OCR ────────────────────────────────────
export const TABLE_ROW_PATTERN = /\b20\d{2}\s*[|\t]\s*([\d\s,.']+)/;

/**
 * Cherche la valeur d'une case dans le texte OCR brut (enrichi par Google Doc AI).
 * Stratégie:
 *   1. Bloc STRUCTURED FIELDS (injecté par google-document-ai.ts)
 *   2. Code de case explicite (box_14:, case 14:, 14:)
 *   3. Keywords FR dans le texte
 *   4. Pattern tableau Google Doc AI (2025 | montant | NAS | code)
 */
export function findBoxValueInText(
  ocrText: string,
  box: BoxDef,
): string | null {
  // 1. Structured fields (haute confiance — Google Document AI)
  const structStart = ocrText.indexOf("--- STRUCTURED FIELDS ---");
  if (structStart >= 0) {
    const structText = ocrText.slice(structStart);
    const candidates = [`box_${box.code}`, `case_${box.code}`, box.code];
    for (const key of candidates) {
      const pat = new RegExp(`${key.replace(/[()]/g, "\\$&")}[:\\s]+([\\d\\s,.']+)`, "i");
      const m = structText.match(pat);
      if (m?.[1] && parseMontantOCR(m[1]) !== null) return m[1].trim();
    }
  }

  // 2. Code de case explicite dans le texte brut
  const codePatterns = [
    new RegExp(`box[_\\s]?${box.code}[:\\s]+([\\d\\s,.']+)`, "i"),
    new RegExp(`case[_\\s]?${box.code}[:\\s]+([\\d\\s,.']+)`, "i"),
    new RegExp(`\\b${box.code}\\s*[:\\-]\\s*([\\d][\\d\\s,.']{2,})`, "im"),
  ];
  for (const pat of codePatterns) {
    const m = ocrText.match(pat);
    if (m?.[1] && parseMontantOCR(m[1]) !== null) return m[1].trim();
  }

  // 3. Keywords FR
  const lower = ocrText.toLowerCase();
  const MONEY_RE = /([0-9]{1,3}(?:[\s,\u00a0][0-9]{3})*(?:[.,][0-9]{2})(?!\d)|[0-9]+[.,][0-9]{2}(?!\d))/;
  for (const kw of box.keywords_fr) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx >= 0) {
      const after = ocrText.slice(idx, idx + 120);
      const m = after.match(MONEY_RE);
      if (m?.[1] && parseMontantOCR(m[1]) !== null) return m[1].trim();
    }
  }

  // 4. Pattern tableau (année | montant)
  if (box.code === "14" || box.data_type === "money") {
    const m = ocrText.match(TABLE_ROW_PATTERN);
    if (m?.[1]) {
      const candidate = m[1].trim();
      if (parseMontantOCR(candidate) !== null) return candidate;
    }
  }

  // 5. Format tableau T4A/T4RSP: code de case suivi du montant
  const pat5a = new RegExp("\\b0*" + box.code + "\\s+([0-9][\\d\\s,.']+)", "im");
  const pat5b = new RegExp("\\b0*" + box.code + "\\n([0-9][\\d\\s,.']+)", "im");
  for (const pat5 of [pat5a, pat5b]) {
    const m5 = ocrText.match(pat5);
    if (m5?.[1]) {
      const raw5 = m5[1].trim().split(/\s+/)[0];
      if (parseMontantOCR(raw5) !== null) return raw5;
    }
  }

  return null;
}

/**
 * Classifier un document OCR à partir de ses anchors.
 * Retourne le code du feuillet le plus probable.
 */
export function classifySlip(ocrText: string): string | null {
  const lower = ocrText.toLowerCase();
  // Score par feuillet: nombre d'anchors trouvés
  let best: { code: string; score: number } | null = null;
  for (const slip of SLIP_DICT) {
    let score = 0;
    for (const anchor of slip.anchors) {
      if (lower.includes(anchor.toLowerCase())) score++;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { code: slip.code, score };
    }
  }
  return best?.code ?? null;
}

/**
 * Extraire toutes les cases d'un feuillet depuis le texte OCR.
 * Respecte included_in (anti-double-comptage) et t1_line_condition.
 * Retourne: { fieldCode → { value, amountCents, t1_line, tp1_line, confidence } }
 */
export function extractAllBoxes(
  ocrText: string,
  slipCode: string,
): Array<{
  code: string;
  label_fr: string;
  rawValue: string | null;
  amountCents: number | null;
  t1_line: string | null;
  tp1_line: string | null;
  hasCondition: boolean;
  autoDeductionLine: string | null;
  includedIn: string | null;
  confidence: number;
}> {
  const slip = getSlipDict(slipCode);
  if (!slip) return [];

  return slip.boxes.map(box => {
    const rawValue = box.data_type === "money"
      ? findBoxValueInText(ocrText, box)
      : null;
    const amountCents = rawValue ? parseMontantOCR(rawValue) : null;

    // Confiance: structured fields = 92%, keywords = 75%, non trouvé = 0%
    let confidence = 0;
    if (rawValue) {
      const structStart = ocrText.indexOf("--- STRUCTURED FIELDS ---");
      if (structStart >= 0) {
        const key = `box_${box.code}`;
        confidence = ocrText.slice(structStart).toLowerCase().includes(key.toLowerCase()) ? 92 : 75;
      } else {
        confidence = 75;
      }
    }

    return {
      code: box.code,
      label_fr: box.label_fr,
      rawValue,
      amountCents,
      t1_line: box.t1_line,
      tp1_line: box.tp1_line,
      hasCondition: !!box.t1_line_condition,
      autoDeductionLine: box.auto_deduction_line ?? null,
      includedIn: box.included_in ?? null,
      confidence,
    };
  });
}
