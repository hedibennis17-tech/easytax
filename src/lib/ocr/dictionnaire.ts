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

import {
  enrichLegacySlips,
  SUPPLIED_OCR_DICTIONARY_VERSION,
  SUPPLIED_OCR_SEGMENTATION_RULES,
} from "./enriched-dictionary";

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
  /** Métadonnées du dictionnaire pancanadien enrichi, sans remplacer les mappings historiques. */
  ocrAliases?: string[];
  fieldId?: string;
  semanticConcept?: string;
  dataType?: string;
  source?: unknown;
  mapping?: unknown;
  relationships?: unknown;
  validation?: unknown;
  confidencePolicy?: unknown;
  provenanceRequired?: boolean;
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
// Les 28 feuillets historiques restent compatibles; ils sont enrichis à l’exécution
// par le JSON pancanadien fourni (313 concepts sémantiques et alias OCR additionnels).
export const SLIP_DICT: SlipDef[] = enrichLegacySlips(_raw.slips);
export const OCR_DICTIONARY_VERSION = SUPPLIED_OCR_DICTIONARY_VERSION;
export const T1_DICT:  Record<string, T1LineDef>  = _raw.t1_lines  as Record<string, T1LineDef>;
export const TP1_DICT: Record<string, TP1LineDef> = _raw.tp1_lines as Record<string, TP1LineDef>;
export const PROVINCE_DICT: ProvinceDef[] = _raw.provinces;
export const SEGMENTATION_RULES: string[] = [...new Set([
  ..._raw.segmentation_rules,
  ...SUPPLIED_OCR_SEGMENTATION_RULES,
])];

// ── Helpers de lookup ─────────────────────────────────────────────────────────
export function getSlipDict(slipCode: string): SlipDef | null {
  const normalized = slipCode.trim().toUpperCase().replace(/[\s_-]+/g, "");
  return SLIP_DICT.find(s => s.code.toUpperCase().replace(/[\s_-]+/g, "") === normalized) ?? null;
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
  const visual = raw.replace(/\u00a0/g, " ").trim();
  // Certains feuillets mettent les cents dans une cellule adjacente : « 7 201 32 ».
  // Ne jamais transformer cette valeur en 720 132 $.
  const spacedCents = visual.match(/^(-?)(\d{1,3}(?:[ ,]\d{3})+)\s+(\d{2})$/);
  let s = spacedCents
    ? `${spacedCents[1]}${spacedCents[2].replace(/[ ,]/g, "")}.${spacedCents[3]}`
    : raw.replace(/[$€¥£\u00a0\s]/g, "");
  // Détecter format FR (virgule décimale) vs EN (point décimal)
  const hasCommaDecimal = /\d,\d{2}$/.test(s) && !s.includes(".");
  if (hasCommaDecimal) {
    s = s.replace(/\s/g, "").replace(",", ".");
  } else {
    s = s.replace(/,(?=\d{3})/g, "").replace(",", ".");
  }
  // Rejeter si plus de 2 décimales (ex: "1580,8016" = deux montants collés)
  if (/[.,]\d{3,}/.test(raw.replace(/\s/g, ""))) return null;
  // Rejeter les codes de cases isolés (ex: "024"), mais conserver un montant
  // entier à quatre chiffres (ex: « 7201 ») : plusieurs T5007 n'impriment pas
  // les cents et l'ancien seuil de 5 chiffres les supprimait à tort.
  if (/^\d{1,3}$/.test(s) && !/[$€¥£,\.\s]/.test(visual)) return null;
  // Rejeter les années fiscales (2020–2029) : "2025" n'est JAMAIS un montant.
  if (/^20[2-9]\d$/.test(s.trim())) return null;
  // Rejeter les numéros d'assurance sociale (9 chiffres consécutifs sans décimals).
  if (/^\d{9}$/.test(s.replace(/\s/g, ""))) return null;
  // Rejeter les numéros de lignes T1/TP-1 fréquemment confondus avec des montants.
  // Ces valeurs apparaissent souvent dans les feuillets CRA Mon Dossier comme libellés de ligne.
  const T1_LINE_NUMBERS = new Set([
    10100, 10400, 11300, 11400, 11500, 11700, 11900, 12100, 12199, 12600,
    12700, 12900, 13000, 13010, 13500, 13900, 14400, 14500, 14600,
    20800, 21200, 21400, 21900, 22900, 23200, 25000,
    30800, 31200, 32300, 34900, 43700,
  ]);
  const sInt = parseInt(s, 10);
  if (!isNaN(sInt) && T1_LINE_NUMBERS.has(sInt) && /^\d{5}$/.test(s.trim())) return null;
  const num = parseFloat(s);
  // Rejeter < 1$ (codes de cases qui passent la regex) et > 9 999 999$
  if (isNaN(num) || num < 0.01 || num > 9_999_999) return null;
  return Math.round(num * 100);
}

// ── Recherche de valeur dans le texte OCR ────────────────────────────────────
export const TABLE_ROW_PATTERN = /\b20\d{2}\s*[|\t]\s*([\d\s,.']+)/;

/**
 * Extrait les métadonnées générales d'un feuillet depuis le texte OCR
 * (type, année, employeur, NAS) — indépendantes des cases
 */
export function extractSlipMetadata(ocrText: string): {
  slipType: string | null;
  taxYear: number | null;
  employerName: string | null;
  recipientNas: string | null;
} {
  // Année fiscale — priorité: phrase explicite "de 2025" > "Année d'imposition" > min year
  // On utilise le MIN (pas MAX) pour éviter que la date du rapport "6 octobre 2026"
  // écrase l'année fiscale 2025 dans les documents CRA Mon Dossier.
  const explicitYearM =
    ocrText.match(/(?:Feuillet|Statement)\s+(?:T4A?|T5007|T5|T3|RL-\d+|T4E|T2202)\s+(?:de\s+|for\s+)?(20\d{2})/i) ??
    ocrText.match(/Ann[ée]e\s+d['\u2019]imposition\s*[:\s]\s*(20\d{2})/i) ??
    ocrText.match(/Tax\s+year\s*[:\s]\s*(20\d{2})/i) ??
    ocrText.match(/(?:Pour\s+l['\u2019]ann[ée]e|for\s+the\s+year)\s+(20\d{2})/i);
  let taxYear: number | null = null;
  if (explicitYearM) {
    taxYear = parseInt(explicitYearM[1]);
  } else {
    const allYears = [...(ocrText.matchAll(/\b(20[2-9]\d)\b/g))].map(m => parseInt(m[1]));
    if (allYears.length > 0) taxYear = Math.min(...allYears);
  }

  // Type de feuillet
  const typePatterns = [
    /(T4A?\(OAS\)|T4A?\(P\)|T4[A-Z]{0,3}|T5007|T5008|T5013|T5|T3|T2202|RL-\d{1,2})/i,
  ];
  let slipType: string | null = null;
  for (const pat of typePatterns) {
    const m = ocrText.match(pat);
    if (m?.[1]) { slipType = m[1].toUpperCase(); break; }
  }

  // Nom employeur/payeur
  const employerPatterns = [
    /(?:Payer.{0,3}name|Nom.{0,3}payeur|Employer.{0,3}name)\s*[:\-]?\s*([A-Za-z][^\n]{3,60})/i,
    /(?:organisme|employeur)\s*[:\-]?\s*([A-Za-z][^\n]{3,60})/i,
  ];
  let employerName: string | null = null;
  for (const pat of employerPatterns) {
    const m = ocrText.match(pat);
    if (m?.[1]?.trim()) { employerName = m[1].trim(); break; }
  }

  // NAS (format: 3 chiffres espace/tiret 3 chiffres espace/tiret 3 chiffres)
  const nasMatch = ocrText.match(/(\d{3}[\s\-|]\d{3}[\s\-|]\d{3})/);
  const recipientNas = nasMatch?.[1]?.replace(/[\s|]/g, "-") ?? null;

  return { slipType, taxYear, employerName, recipientNas };
}

const MONEY_CAPTURE = "([0-9]{1,3}(?:[\\s,\\u00a0][0-9]{3})*(?:[.,][0-9]{2}|\\s+[0-9]{2})(?!\\d)|[0-9]+[.,][0-9]{2}(?!\\d)|[0-9]{4,}(?!\\d))";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asMoney(raw: string | undefined): string | null {
  const value = raw?.trim() ?? "";
  return parseMontantOCR(value) !== null ? value : null;
}

function relaxedLabelPattern(label: string): string {
  // Les apostrophes droites et typographiques sont fréquemment perdues par l’OCR.
  return escapeRegex(label).replace(/[’']/g, "[’']?");
}

/**
 * Lecture d’une rangée de gabarit : « 10 Workers' compensation benefits 7 201,32 ».
 * Cette stratégie intervient avant la recherche par mots isolés afin que le montant
 * reste attaché à son libellé de case, même dans un tableau sans séparateur |.
 */
function findLayoutBoundValue(ocrText: string, box: BoxDef): string | null {
  const labels = [box.label_fr, box.label_en, ...(box.ocrAliases ?? [])]
    .filter((label): label is string => Boolean(label && label.length >= 5))
    .map(relaxedLabelPattern);

  const patterns: RegExp[] = [];
  if (labels.length > 0) {
    patterns.push(new RegExp(`(?:\\b${escapeRegex(box.code)}\\b[\\s:—–-]*)?(?:${labels.join("|")})[^\\r\\n]{0,160}?${MONEY_CAPTURE}`, "i"));
  }

  // RL-1 : Revenu Québec imprime "X - Libellé\n<montant>" avec le code de case en
  // premier, le libellé sur la même ligne et le montant sur la ligne suivante.
  // Pattern pour toutes les cases RL-1 (alphabétiques A, C, E… et alphanumériques B.A, B.B).
  // On n'active ce pattern que si le texte OCR contient "RL-1" ou "relevé 1" (identification).
  if (/RL-?1\b|Relevé\s+1/i.test(ocrText.slice(0, 600))) {
    const codeEsc = escapeRegex(box.code);
    patterns.unshift(
      // montant sur la ligne suivante : "A - Revenus d'emploi\n1 482,62"
      // (?![A-Z][-–—.]) empêche de capturer la ligne suivante si elle commence par un autre code de case
      new RegExp(`\\b${codeEsc}\\s*[-–—]\\s*[^\\r\\n]{0,80}\\r?\\n\\s*(?![A-Z][-\u2013\u2014\.\s])${MONEY_CAPTURE}`, "i"),
      // montant sur la même ligne : "A - ... 1 482,62"
      new RegExp(`\\b${codeEsc}\\s*[-–—]\\s*[^\\r\\n]{0,80}?${MONEY_CAPTURE}`, "i"),
      // "A  1 482,62" (code seul + espace + montant)
      new RegExp(`^${codeEsc}\\s{2,}${MONEY_CAPTURE}`, "im"),
    );
  }

  // Gabarits éprouvés par les feuillets T5007 : la ligne contient le code, le
  // libellé, le montant, le NAS puis le code de relevé, sans nécessairement un |.
  if (box.code === "10" && /workers'?\s+compensation|indemnités?\s+(?:d['’]indemnisation\s+)?(?:pour\s+)?accidents?\s+du\s+travail/i.test(`${box.label_fr} ${box.label_en}`)) {
    patterns.unshift(
      new RegExp(`(?:\\b10\\b\\s*)?(?:workers?[’']?\\s+compensation\\s+benefits|indemnit[ée]s?(?:\\s+d[’']indemnisation)?\\s+(?:pour\\s+)?accidents?\\s+du\\s+travail)[^\\r\\n]{0,180}?${MONEY_CAPTURE}`, "i"),
      new RegExp(`\\b20\\d{2}\\s+10\\s+(?:workers?[’']?\\s+compensation\\s+benefits|indemnit[ée]s?(?:\\s+d[’']indemnisation)?\\s+(?:pour\\s+)?accidents?\\s+du\\s+travail)[^\\r\\n]{0,180}?${MONEY_CAPTURE}`, "i"),
    );
  }

  for (const pattern of patterns) {
    const m = pattern.exec(ocrText);
    if (!m?.[1]) continue;
    // Exclure tout match dans un contexte "redressement pour" (ajustements historiques T5007)
    const matchPos = m.index ?? 0;
    const before80 = ocrText.slice(Math.max(0, matchPos - 80), matchPos);
    if (/redressement\s+pour/i.test(before80)) continue;
    const value = asMoney(m[1]);
    if (value) return value;
  }
  return null;
}

/**
 * Cherche la valeur d'une case dans le texte OCR brut (enrichi par Google Doc AI).
 * Stratégie:
 *   1. Bloc STRUCTURED FIELDS (injecté par google-document-ai.ts)
 *   2. Rangée de gabarit libellé → montant (T4, T4A, T5007, RL)
 *   3. Code de case explicite (box_14:, case 14:, 14:)
 *   4. Keywords français et anglais, puis tableau Google Document AI
 */
export function findBoxValueInText(
  ocrText: string,
  box: BoxDef,
): string | null {
  // 1. Structured fields (haute confiance — Google Document AI)
  const structStart = ocrText.indexOf("--- STRUCTURED FIELDS ---");
  if (structStart >= 0) {
    const structText = ocrText.slice(structStart);
    const candidates = [...new Set([
      `box_${box.code}`,
      `case_${box.code}`,
      box.code,
      ...(box.ocrAliases ?? []),
    ])];
    for (const key of candidates) {
      const pat = new RegExp(`${escapeRegex(key)}[:\\s]+${MONEY_CAPTURE}`, "i");
      const m = structText.match(pat);
      if (m?.[1] && parseMontantOCR(m[1]) !== null) return m[1].trim();
    }
  }

  // 2. Rangée de gabarit complète, avant les mots isolés qui peuvent traverser
  // une colonne voisine ou une autre copie du même feuillet.
  const layoutValue = findLayoutBoundValue(ocrText, box);
  if (layoutValue) return layoutValue;

  // 3. Code de case explicite dans le texte brut
  // Inclut le format CRA Mon Dossier: "Case 14\n<label>\n<montant>"
  const codePatterns = [
    new RegExp(`box[_\\s]?${box.code}[:\\s]+([\\d\\s,.']+)`, "i"),
    new RegExp(`case[_\\s]?${box.code}[:\\s]+([\\d\\s,.']+)`, "i"),
    new RegExp(`\\b${box.code}\\s*[:\\-]\\s*([\\d][\\d\\s,.']{2,})`, "im"),
    // "Case 14\n<libellé quelconque>\n<montant>" — CRA Mon Dossier
    new RegExp(`(?:Case|Box)\\s+0*${box.code}\\b[^\\n]*\\n[^\\n]{0,80}\\n\\s*([0-9][\\d\\s,.']+)`, "im"),
    // "Case 14\n<montant>" — variante sans libellé intermédiaire
    new RegExp(`(?:Case|Box)\\s+0*${box.code}\\b[^\\n]*\\n\\s*([0-9][\\d\\s,.']+)`, "im"),
  ];
  for (const pat of codePatterns) {
    const m = ocrText.match(pat);
    if (m?.[1] && parseMontantOCR(m[1]) !== null) return m[1].trim();
  }

  // 3b. T5007 box 10 : le montant d’indemnisation est souvent la toute première
  // valeur monétaire sur la page (avant même les libellés). Si le texte OCR commence
  // par un montant sur la 1re ligne non vide, on le capture ici avant que la stratégie
  // des mots-clés ne se perde dans la section "Redressement pour indemnités reçues".
  // On active aussi quand le texte démarre directement par un montant (vieux relevés CNESST).
  if (box.code === "10" && (/t5007/i.test(ocrText.slice(0, 400)) || /^\s*[\d][\d\s,.’]{3,}/.test(ocrText))) {
    const firstLineMatch = ocrText.match(/^\s*([\d][\d\s,.’]{3,})\s*(?:\r?\n|\r)/);
    if (firstLineMatch?.[1]) {
      const val = asMoney(firstLineMatch[1].trim());
      if (val) return val;
    }
  }

  // 4. Keywords FR et EN — secours lorsque le gabarit n’a pas de libellé complet.
  // Pour T5007 box 10, on filtre les faux positifs : le mot "indemnités" peut
  // apparaître dans "Redressement pour indemnités reçues" suivi d’une adresse.
  const lower = ocrText.toLowerCase();
  const MONEY_RE = new RegExp(MONEY_CAPTURE);
  for (const kw of [...new Set([...box.keywords_fr, ...(box.ocrAliases ?? []), ...box.keywords_en])]) {
    const kwLower = kw.toLowerCase();
    const idx = lower.indexOf(kwLower);
    // Éviter que le keyword soit un sous-mot: "150" dans "1500" ou "15000".
    // Vérifier que le caractère après le keyword n'est pas un chiffre.
    if (idx >= 0 && /^\d+$/.test(kw)) {
      const charAfter = lower[idx + kw.length];
      if (charAfter && /\d/.test(charAfter)) continue;
    }
    if (idx >= 0) {
      const after = ocrText.slice(idx, idx + 120);
      // Exclure un match de mot-clé si "redressement pour" précède dans les 80 chars avant.
      // Ce contexte décrit des ajustements historiques, pas la case 10 du T5007.
      const before = ocrText.slice(Math.max(0, idx - 80), idx);
      if (/redressement\s+pour/i.test(before)) continue;
      // Exclure contexte "account number" / "numéro de compte" (numeros de compte employé)
      if (/(?:account\s+number|numéro\s+de\s+compte)[:\s]*$/i.test(before)) continue;
      const m = after.match(MONEY_RE);
      if (m?.[1] && parseMontantOCR(m[1]) !== null) {
        // Exclure les numéros civiques d'adresse (ex: "1547, RUE TREPANIER")
        const matchStart = idx + (m.index ?? 0);
        const surroundAfter = ocrText.slice(matchStart, matchStart + 50);
        if (/^\d+,?\s+(?:rue|avenue|boul|blvd|chemin|ch\.|place|pl\.|drive|dr\.|road|rd\.)\b/i.test(surroundAfter)) continue;
        return m[1].trim();
      }
    }
  }

  // 5. Pattern tableau (année | montant) — SEULEMENT pour T4/T4A qui ont un layout
  // "année TAB montant". PAS pour T5007 (évite de lire "2024 | 15858,42" dans la
  // section d'ajustements historiques comme si c'était la case 10).
  if (box.code === "14" && box.data_type === "money") {
    const m = ocrText.match(TABLE_ROW_PATTERN);
    if (m?.[1]) {
      const candidate = m[1].trim();
      if (parseMontantOCR(candidate) !== null) return candidate;
    }
  }

  // 6. Format tableau T4A/T4RSP: code de case suivi du montant.
  // Garde pour T4A (codes 3 chiffres) mais exclut T5007 box 10 car le pattern
  // "\b10\s+2025..." lirait l'année comme montant. On restreint aux codes 3+ chiffres.
  // Format CRA Mon Dossier T4A : "022\nligne 43700\n<montant>" — on saute la ligne "ligne XXXXX".
  if (box.code.length >= 3) {
    const pat5a = new RegExp("\\b0*" + box.code + "\\s+([0-9][\\d\\s,.']+)", "im");
    const pat5b = new RegExp("\\b0*" + box.code + "\\n([0-9][\\d\\s,.']+)", "im");
    // Pattern pour "CODE\nligne XXXXX\nAMOUNT" (CRA Mon Dossier)
    const pat5c = new RegExp("\\b0*" + box.code + "\\s*\\n(?:ligne?\\s+\\d+[^\\n]*\\n)\\s*([0-9][\\d\\s,.']+)", "im");
    for (const pat5 of [pat5c, pat5a, pat5b]) {
      const m5 = ocrText.match(pat5);
      if (m5?.[1]) {
        const raw5 = m5[1].trim().split(/\s+/)[0];
        // Rejeter si la valeur est précédée d'un libellé "line XXXXX" ou "account number"
        const matchPos = m5.index ?? 0;
        const ctxBefore = ocrText.slice(Math.max(0, matchPos - 60), matchPos + 10);
        if (/\b(?:ligne?|line)\s+\d+\s*$/i.test(ctxBefore)) continue;
        if (/(?:account\s+number|numéro\s+de\s+compte)[:\s]*$/i.test(ctxBefore)) continue;
        if (parseMontantOCR(raw5) !== null) return raw5;
      }
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

  // Tronquer le texte OCR avant la page d'instructions (page 2 des feuillets CRA).
  // La page 2 des T4A/T4/T5 contient les instructions de l'ARC et ne contient
  // aucune donnée — mais l'OCR y lit des numéros de lignes (33099, 20600...) comme montants.
  // Marqueurs fiables de début de page d'instructions :
  const INSTRUCTIONS_MARKERS = [
    "Do not report on your tax return",
    "Ne déclarez pas les renseignements",
    "Canada Revenue Agency use only",
    "À l'usage de l'Agence du revenu du Canada",
    "See the privacy notice on your return",
    "Consultez l'avis de confidentialité",
  ];
  let cleanText = ocrText;
  for (const marker of INSTRUCTIONS_MARKERS) {
    const idx = cleanText.indexOf(marker);
    if (idx > 200) { // Garder au moins 200 chars pour ne pas tronquer trop tôt
      cleanText = cleanText.slice(0, idx);
      break;
    }
  }

  return slip.boxes.map(box => {
    const rawValue = box.data_type === "money"
      ? findBoxValueInText(cleanText, box)
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
