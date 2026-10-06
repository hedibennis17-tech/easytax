/**
 * universal-dict.ts
 * Wrapper TypeScript pour le dictionnaire universel pancanadien v2
 * 
 * Architecture:
 *   DOCUMENT → FIELD → SEMANTIC CONCEPT → TAX RULE → MAPPING → RETURN LINE
 * 
 * Jamais: OCR → valeur → T1 directement
 */
import dictJson from "./universal-tax-dictionary.json";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UniversalField {
  fieldId: string;                  // ex: "CA.FED.T4.14"
  document: string;                 // ex: "T4"
  box: string;                      // ex: "14"
  type: string;
  labelFr: string;
  labelEn: string;
  keywordsFr: string[];
  keywordsEn: string[];
  ocrAliases: string[];
  semanticConcept: string;          // ex: "employment_income"
  taxMapping: { t1: string[]; tp1: string[] };
  includedIn: string[];             // anti-double-comptage
  relatedFields?: string[];
  nullable: boolean;
  allowNegative: boolean;
  duplicatePolicy: string;
  confidenceRequired: number;
  autoDeduction?: string;
  note?: string;
}

export interface UniversalDocument {
  code: string;
  nameFr: string;
  nameEn: string;
  authority: string;
  government: string;
  jurisdiction: string;
  category: string;
  anchors: string[];
  identityFields?: string[];
  fields: string[];
  taxYears?: number[];
}

export interface TaxConcept {
  category: string;
  t1: string[];
  tp1: string[];
  note?: string;
}

export interface ExtractionResult {
  fieldId: string;
  box: string;
  rawValue: string | null;
  normalizedValue: number | null;   // en dollars
  amountCents: number | null;       // en cents pour la DB
  confidence: number;
  semanticConcept: string;
  taxMapping: { t1: string[]; tp1: string[] };
  includedIn: string[];
  status: "extracted" | "unmapped" | "review_required" | "unknown";
  labelFr: string;
  autoDeduction?: string;
}

// ── Accès au dictionnaire ──────────────────────────────────────────────────

const DICT = dictJson as unknown as {
  fields: Record<string, UniversalField>;
  documents: Record<string, UniversalDocument>;
  taxConcepts: Record<string, TaxConcept>;
  ocrRules: { numeric: { commonConfusions: Record<string, string>; formats: string[] }; minimumAmount: number; maximumAmount: number };
  confidenceRules: Record<string, { min: number; max: number; action: string }>;
  returnStructures: { T1: { lines: Record<string, string> }; TP1: { lines: Record<string, string> } };
  unmappedFieldPolicy: { action: string; status: string; requiresReview: boolean };
};

// ── Normalisation des montants ─────────────────────────────────────────────

export function normalizeMontant(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  let s = raw.replace(/[$€¥£\u00a0]/g, "").trim();

  // Rejeter si 3+ chiffres après virgule (deux montants collés: "1580,8016")
  if (/[.,]\d{3,}/.test(s.replace(/\s/g, ""))) return null;

  // Corriger confusions OCR communes (O→0, I→1, l→1)
  const confusions = DICT.ocrRules.numeric.commonConfusions;
  for (const [wrong, correct] of Object.entries(confusions)) {
    s = s.replace(new RegExp(wrong, "g"), correct);
  }

  // Détecter format FR vs EN
  const isFormatFR = /\d,\d{2}$/.test(s) && !s.includes(".");
  if (isFormatFR) {
    s = s.replace(/\s/g, "").replace(",", ".");
  } else {
    s = s.replace(/\s/g, "").replace(/,(?=\d{3})/g, "");
  }

  // Rejeter les codes de cases (ex: "024", "048") — pas de décimale, <5 chiffres
  if (/^\d{1,4}$/.test(s)) return null;

  const num = parseFloat(s);
  if (isNaN(num)) return null;
  if (num < DICT.ocrRules.minimumAmount || num > DICT.ocrRules.maximumAmount) return null;

  return num;
}

export function toCents(amount: number | null): number | null {
  if (amount === null) return null;
  return Math.round(amount * 100);
}

// ── Accès aux fields ───────────────────────────────────────────────────────

export function getField(fieldId: string): UniversalField | null {
  return DICT.fields[fieldId] ?? null;
}

export function getFieldsForDocument(docCode: string): UniversalField[] {
  const doc = DICT.documents[docCode.replace("-","_").replace("(","_").replace(")","")];
  if (!doc) return [];
  return doc.fields.map(fid => DICT.fields[fid]).filter(Boolean);
}

export function getDocument(code: string): UniversalDocument | null {
  const key = code.replace("-","_").replace("(","_").replace(")","");
  return DICT.documents[key] ?? null;
}

export function getAllDocuments(): UniversalDocument[] {
  return Object.values(DICT.documents) as UniversalDocument[];
}

export function getTaxConcept(concept: string): TaxConcept | null {
  return DICT.taxConcepts[concept] ?? null;
}

// ── Classification ─────────────────────────────────────────────────────────

export function classifyDocument(ocrText: string): { code: string; score: number } | null {
  const text = ocrText.toLowerCase();
  let best: { code: string; score: number } | null = null;

  for (const doc of Object.values(DICT.documents) as UniversalDocument[]) {
    let score = 0;
    for (const anchor of doc.anchors) {
      if (text.includes(anchor.toLowerCase())) score++;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { code: doc.code, score };
    }
  }

  return best;
}

// ── Extraction universelle ─────────────────────────────────────────────────

export function extractFieldValue(ocrText: string, field: UniversalField): string | null {
  const text = ocrText;

  // Stratégie 1: STRUCTURED FIELDS de Google Doc AI
  const structStart = text.indexOf("--- STRUCTURED FIELDS ---");
  if (structStart >= 0) {
    const structText = text.slice(structStart);
    for (const alias of field.ocrAliases) {
      const pat = new RegExp(`${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[:\\s]+([\\d,. ]+)`, "i");
      const m = structText.match(pat);
      if (m?.[1] && normalizeMontant(m[1]) !== null) return m[1].trim();
    }
  }

  // Stratégie 2: code de case explicite (ex: "box_14", "case 14")
  for (const alias of field.ocrAliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pat = new RegExp(`\\b${escaped}\\b[^\\n]{0,20}?([\\d][\\d\\s,.]+)`, "i");
    const m = text.match(pat);
    if (m?.[1]) {
      const val = m[1].trim().split(/\s+/)[0];
      if (normalizeMontant(val) !== null) return val;
    }
  }

  // Stratégie 3: keywords FR
  for (const kw of field.keywordsFr) {
    if (kw.match(/^\d+$/)) continue; // skip pure numeric keywords
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pat = new RegExp(`${escaped}[^\\n]{0,30}?([\\d][\\d\\s,.]+)`, "i");
    const m = text.match(pat);
    if (m?.[1]) {
      const val = m[1].trim().split(/\s+/)[0];
      if (normalizeMontant(val) !== null) return val;
    }
  }

  // Stratégie 4: keywords EN
  for (const kw of field.keywordsEn) {
    if (kw.match(/^\d+$/)) continue;
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pat = new RegExp(`${escaped}[^\\n]{0,30}?([\\d][\\d\\s,.]+)`, "i");
    const m = text.match(pat);
    if (m?.[1]) {
      const val = m[1].trim().split(/\s+/)[0];
      if (normalizeMontant(val) !== null) return val;
    }
  }

  // Stratégie 5: format tableau "CODE MONTANT" (ex: "048  7 201,32")
  for (const alias of field.ocrAliases) {
    if (!alias.match(/^\d+$/)) continue; // seulement les aliases numériques
    const pat5 = new RegExp("\\b0*" + alias + "\\s+([0-9][\\d\\s,.']+)", "im");
    const m5 = text.match(pat5);
    if (m5?.[1]) {
      const raw5 = m5[1].trim().split(/\s+/)[0];
      if (normalizeMontant(raw5) !== null) return raw5;
    }
  }

  return null;
}

// ── Extraction complète d'un document ─────────────────────────────────────

export function extractDocument(ocrText: string, docCode: string, taxYear = 2025): ExtractionResult[] {
  const fields = getFieldsForDocument(docCode);
  const results: ExtractionResult[] = [];

  for (const field of fields) {
    const rawValue = extractFieldValue(ocrText, field);
    const amount = normalizeMontant(rawValue);
    const cents = toCents(amount);

    // Déterminer le niveau de confiance
    let confidence = 0;
    if (rawValue) {
      // Confiance basée sur la stratégie qui a trouvé la valeur
      confidence = rawValue ? field.confidenceRequired + 0.05 : 0;
      if (cents === null) confidence = 0;
    }

    // Status
    let status: ExtractionResult["status"] = "extracted";
    if (!rawValue) status = "unmapped";
    else if (confidence < 0.70) status = "review_required";
    else if (!field.semanticConcept) status = "unknown";

    results.push({
      fieldId: field.fieldId,
      box: field.box,
      rawValue,
      normalizedValue: amount,
      amountCents: cents,
      confidence,
      semanticConcept: field.semanticConcept,
      taxMapping: field.taxMapping,
      includedIn: field.includedIn,
      status,
      labelFr: field.labelFr,
      autoDeduction: field.autoDeduction,
    });
  }

  return results.filter(r => r.rawValue !== null || r.status !== "unmapped");
}

// ── Identité du document ───────────────────────────────────────────────────

export function extractDocumentIdentity(ocrText: string): {
  slipType: string | null;
  taxYear: number | null;
  employerName: string | null;
  recipientNas: string | null;
  government: string | null;
  jurisdiction: string | null;
} {
  // Type
  const typeMatch = ocrText.match(/\b(T4A?\(OAS\)|T4A?\(P\)|T4[A-Z]{0,4}|T5007|T5008|T5013|T5|T3|T2202|RL-\d{1,2})\b/i);
  const slipType = typeMatch?.[1]?.toUpperCase() ?? null;

  // Année
  const yearMatches = ocrText.match(/\b(20\d{2})\b/g);
  const taxYear = yearMatches
    ? parseInt(yearMatches.sort().reverse()[0])
    : null;

  // Employeur
  const empPat = /(?:Payer.{0,3}name|Nom.{0,3}payeur|Employer.{0,3}name|Nom.{0,3}employeur|Nom.{0,3}organisme).{0,20}?([A-Za-zÀ-ÿ][^\n]{5,60})/i;
  const empMatch = ocrText.match(empPat);
  const employerName = empMatch?.[1]?.trim() ?? null;

  // NAS
  const nasMatch = ocrText.match(/\b(\d{3}[\s\-|]\d{3}[\s\-|]\d{3})\b/);
  const recipientNas = nasMatch?.[1]?.replace(/[\s|]/g, "-") ?? null;

  // Gouvernement depuis le type
  const doc = slipType ? getDocument(slipType) : null;
  const government = doc?.government ?? (slipType?.startsWith("RL") ? "provincial" : "federal");
  const jurisdiction = doc?.jurisdiction ?? (slipType?.startsWith("RL") ? "QC" : "CA");

  return { slipType, taxYear, employerName, recipientNas, government, jurisdiction };
}

// ── Confidence engine ──────────────────────────────────────────────────────

export function getConfidenceDecision(confidence: number): { action: string; label: string } {
  if (confidence >= 0.95) return { action: "auto_accept",          label: "Accepté automatiquement" };
  if (confidence >= 0.85) return { action: "accept_with_flag",     label: "Accepté — révision optionnelle" };
  if (confidence >= 0.70) return { action: "hold_for_review",      label: "Révision requise" };
  return                         { action: "block_manual_required", label: "Révision manuelle obligatoire" };
}

// ── Exports ────────────────────────────────────────────────────────────────

export { DICT };
export const UNIVERSAL_DICT_VERSION = "2.0.0";
