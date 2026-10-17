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
  // Exception: si spacedCents a matché, le raw "7,212 90" devient "7,21290" sans espaces
  // mais c'est un faux positif — on a déjà validé le format, pas la peine de rejeter.
  if (!spacedCents && /[.,]\d{3,}/.test(raw.replace(/\s/g, ""))) return null;
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
    // "Feuillet T4A de 2023" / "T4A Statement 2023"
    ocrText.match(/(?:Feuillet|Statement|Slip)\s+(?:T4A?|T5007|T5|T3|RL-?\d+|T4E|T2202)\s+(?:de\s+|for\s+)?(20\d{2})/i) ??
    // "T4A 2023" sans mot avant
    ocrText.match(/\b(?:T4A?|T5007|T5|T3|RL-?\d+|T4E|T2202)\s+(20\d{2})\b/i) ??
    ocrText.match(/Ann[ée]e\s+d['\u2019]imposition\s*[:\s]\s*(20\d{2})/i) ??
    ocrText.match(/Tax\s+year\s*[:\-]?\s*(20\d{2})/i) ??
    ocrText.match(/(?:Pour\s+l['\u2019]ann[ée]e|for\s+the\s+(?:tax\s+)?year)\s+(20\d{2})/i) ??
    ocrText.match(/(?:Taxation\s+year|Ann[ée]e\s+fiscale)\s*[:\-]?\s*(20\d{2})/i) ??
    ocrText.match(/\(\s*(20[12]\d)\s*\)/);
  let taxYear: number | null = null;
  if (explicitYearM) {
    taxYear = parseInt(explicitYearM[1]);
  } else {
    // Fallback: plus petite année dans le texte, en excluant l'année courante+1
    const currentYear = new Date().getFullYear();
    const allYears = [...(ocrText.matchAll(/\b(20[1-9]\d)\b/g))]
      .map(m => parseInt(m[1]))
      .filter(y => y <= currentYear);
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
  // RL-1 Revenu Quebec: "Nom de l'employeur ou du payeur\n<NOM SUR LIGNE SUIVANTE>"
  // T4/T4A: "Employer's name / Nom de l'employeur: XYZ"
  // L'ordre: plus precis (RL-1 multilignes) => plus souple (fallback)
  const employerPatterns: RegExp[] = [
    // RL-1 : label + nom sur la MEME ligne
    /(?:Nom\s+(?:de\s+l[’‘']employeur|du\s+payeur)(?:\s+ou\s+du\s+payeur)?)\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9][^\n]{2,100})/i,
    // RL-1 : label + nom sur la LIGNE SUIVANTE (OCR saute ligne)
    /(?:Nom\s+(?:de\s+l[’‘']employeur|du\s+payeur)(?:\s+ou\s+du\s+payeur)?)\s*[:\-]?\r?\n\s*([A-Za-zÀ-ÿ0-9][^\n]{2,100})/i,
    // T4/T4A federal: "Employer's name" ou "Payer's name" meme ligne
    /(?:Employer[’‘']?s?\s+(?:or\s+payer[’‘']?s?\s+)?name|Payer[’‘']?s?\s+name)\s*[:\-\/]?\s*([A-Za-zÀ-ÿ0-9][^\n]{2,100})/i,
    // T4A/T5007: "Payer's name" + nom ligne suivante
    /(?:Payer[’‘']?s?\s+name|Nom\s+du\s+payeur)\s*[:\-]?\r?\n\s*([A-Za-zÀ-ÿ0-9][^\n]{2,100})/i,
    // Fuzzy avec tolérance OCR
    /(?:Payer.{0,5}name|Nom.{0,8}payeur|Employer.{0,5}name)\s*[:\-]?\s*([A-Za-zÀ-ÿ0-9][^\n]{2,80})/i,
    // Fallback mot-cle seul avec séparateur obligatoire
    /(?:organisme|employeur|institution)\s*[:\-]\s*([A-Za-zÀ-ÿ0-9][^\n]{2,80})/i,
  ];
  let employerName: string | null = null;
  for (const pat of employerPatterns) {
    const m = ocrText.match(pat);
    const candidate = m?.[1]?.trim() ?? null;
    if (!candidate) continue;
    // Rejeter faux positifs: NAS (000-000-000), montant pur, trop court
    if (/^\d{3}[\s\-]\d{3}/.test(candidate)) continue;
    if (/^[0-9\s,\.]+$/.test(candidate)) continue;
    if (candidate.length < 3) continue;
    employerName = candidate;
    break;
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
 * Parse la structure tabulaire d'un relevé RL-1 en une seule passe séquentielle.
 *
 * Supporte deux formats OCR.space :
 *
 * Format A — séquentiel (RL-1 physique / scan) :
 *   "A - Revenus d'emploi\n1 482,62\nB.A - Cotisation au RRQ\n74,01\n..."
 *   ou avec montant inline : "A - Revenus d'emploi 1 482,62"
 *
 * Format B — deux colonnes (Mon Dossier Citoyens) :
 *   L'OCR lit la colonne des labels d'abord, puis l'en-tête "Données",
 *   puis la colonne des montants (en sautant les cases vides).
 *   "A - Revenus d'emploi\nB.A - Cotisation au RRQ\nB.B - ...\nC - ...\nDonnées\n1 482,62\n74,01\n19,42\n"
 *   → A=1 482,62, B.A=74,01, C=19,42, B.B vide (cotisation supplémentaire non applicable)
 *
 * Pour le format B, les montants sont assignés automatiquement seulement lorsque
 * la correspondance est déterministe. Si le nombre de montants ne permet pas de
 * prouver la correspondance, aucune valeur n'est décalée vers une autre case :
 * les cases restent vides et le document est laissé à la révision humaine.
 *
 * Retourne une Map<codeRL1, rawMontant> (ex: "A" → "1 482,62")
 */
function parseRL1OcrTable(ocrText: string): Map<string, string> {
  const result = new Map<string, string>();

  // Codes RL-1 valides, du plus long au plus court (pour éviter que "B" matche avant "B.A")
  const RL1_CODES = [
    "B.A", "B.B", "G-1", "G-2", "G-3",
    "A-1","A-2","A-3","A-4","A-5","A-6","A-7","A-9","A-10","A-11","A-12","A-13","A-14",
    "B-1","B-2",
    "D-1","D-2","D-3",
    "K-1",
    "L-2","L-3","L-4","L-7","L-8","L-9","L-10",
    "R-1",
    "V-1",
    "235",
    "A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","V","W",
  ];

  // Codes rarement remplis — prioritairement supposés vides dans le format deux colonnes
  // (cotisations supplémentaires RRQ2, codes complémentaires, etc.)
  const RARELY_FILLED = new Set([
    "B.B","G-2","G-3",
    "A-1","A-2","A-3","A-4","A-5","A-6","A-7","A-9","A-10","A-11","A-12","A-13","A-14",
    "B-1","B-2","D-1","D-2","D-3","K-1",
    "L-2","L-3","L-4","L-7","L-8","L-9","L-10",
    "R-1","V-1","235",
  ]);

  // Regex code RL-1 : "A - Libellé" | "B.A - Libellé" | "235 - Libellé"
  const codeRe = new RegExp(
    `^(${RL1_CODES.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*[-\\u2013\\u2014]\\s*(.{0,120})$`
  );

  // Montant sur toute la ligne — format français ("1 482,62", "74,01")
  const moneyLineRe = /^([0-9]{1,3}(?:[\s\u00a0][0-9]{3})*[.,][0-9]{2})$/;

  // Mots-pivot du format deux colonnes Mon Dossier Citoyens
  const pivotLineRe = /^(Données|Montants|Data|Cases)$/i;

  const lines = ocrText.split(/\r?\n/);
  let pendingCode: string | null = null;

  // Groupe de codes sans montant en attente (format deux colonnes)
  const pendingGroup: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (!line) continue;

    // Mot-pivot "Données" / "Cases" — format deux colonnes Mon Dossier Citoyens
    if (pivotLineRe.test(line) && pendingGroup.length > 0) {
      // Collecter les montants consécutifs qui suivent immédiatement le pivot
      const groupAmounts: string[] = [];
      let j = idx + 1;
      while (j < lines.length) {
        const nl = lines[j].trim();
        if (!nl) { j++; continue; }
        const mm = nl.match(moneyLineRe);
        if (mm) { groupAmounts.push(mm[1]); j++; }
        else break;
      }
      idx = j - 1;  // avancer l'index (la boucle fait idx++ ensuite)

      if (groupAmounts.length > 0) {
        // Heuristique d'assignation :
        // Tentative 1 : montants == codes normaux (cas courant : B.B vide, les autres remplis)
        const normalCodes = pendingGroup.filter(c => !RARELY_FILLED.has(c));
        const rareCodes   = pendingGroup.filter(c =>  RARELY_FILLED.has(c));

        if (groupAmounts.length === normalCodes.length) {
          // Cas typique Mon Dossier Citoyens : les rarement-remplis (B.B…) sont vides
          normalCodes.forEach((c, i) => {
            const val = asMoney(groupAmounts[i]);
            if (val && !result.has(c)) result.set(c, val);
          });
        } else if (groupAmounts.length === pendingGroup.length) {
          // Aucune case vide dans ce groupe
          pendingGroup.forEach((c, i) => {
            const val = asMoney(groupAmounts[i]);
            if (val && !result.has(c)) result.set(c, val);
          });
        } else {
          // Correspondance ambiguë : surtout ne pas décaler un montant vers
          // B.B, D, F, J ou une autre case. Laisser les cases absentes vides
          // force la vérification humaine au lieu de produire une donnée fiscale
          // silencieusement attribuée à la mauvaise case.
          console.warn('[RL-1] Correspondance tabulaire ambiguë — révision requise', {
            pendingCodes: pendingGroup,
            normalCodes,
            rareCodes,
            amountCount: groupAmounts.length,
          });
        }
      }

      pendingGroup.length = 0;
      pendingCode = null;
      continue;
    }

    // Tester si la ligne est une ligne de code RL-1
    const codeMatch = line.match(codeRe);

    if (codeMatch) {
      const foundCode = codeMatch[1];
      const rest = codeMatch[2].trim();

      // Le montant peut être en fin de ligne, après le libellé
      const inlineMoneyMatch = rest.match(/\s+([0-9]{1,3}(?:[\s\u00a0][0-9]{3})*[.,][0-9]{2})$/);
      if (inlineMoneyMatch) {
        const val = asMoney(inlineMoneyMatch[1]);
        if (val && !result.has(foundCode)) result.set(foundCode, val);
        pendingCode = null;
        pendingGroup.length = 0;  // ce code a son montant, fermer le groupe
      } else {
        // Montant attendu sur la ligne suivante (ou via pivot)
        pendingGroup.push(foundCode);
        pendingCode = foundCode;
      }
      continue;
    }

    // Si on attendait un montant pour le code précédent
    if (pendingCode !== null) {
      const moneyMatch = line.match(moneyLineRe);
      if (moneyMatch) {
        const val = asMoney(moneyMatch[1]);
        if (val && !result.has(pendingCode)) result.set(pendingCode, val);
        // Retirer ce code du groupe (il a son montant)
        const gi = pendingGroup.lastIndexOf(pendingCode);
        if (gi >= 0) pendingGroup.splice(gi, 1);
        pendingCode = null;
      } else if (line.length > 30 || /[a-zA-Z\u00c0-\u00ff]{4,}/.test(line)) {
        // Texte substantiel non-pivot → annule l'attente du dernier code
        // mais CONSERVE le groupe (pivot peut encore arriver)
        pendingCode = null;
      }
    }
  }

  return result;
}
/**
 * Lecture d’une rangée de gabarit : « 10 Workers’ compensation benefits 7 201,32 ».
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
  if (/RL-?1\b|Relevé\s+1/i.test(ocrText.slice(0, 1200))) {
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

  // Format OCR.space T4A/T4/T5 : libellé FR ou EN → code de case seul → montant
  // Exemple: "Fees for services\nHonoraires...\n048\n7,212 90"
  if (labels.length > 0) {
    const labelsPattern = labels.join("|");
    const codeEsc = escapeRegex(box.code);
    const multilinePattern = new RegExp(
      `(?:${labelsPattern})[\\s\\S]{0,300}?^\\s*0*${codeEsc}\\s*\\r?\\n\\s*([0-9][\\d\\s,.']+)`,
      "im"
    );
    const m = multilinePattern.exec(ocrText);
    if (m?.[1]) {
      const value = asMoney(m[1]);
      if (value) return value;
    }
  }

  return null;
}

/**
 * Cherche la valeur d'une case dans le texte OCR brut (enrichi par Mistral OCR).
 * Stratégie:
 *   1. Bloc STRUCTURED FIELDS (injecté par le pipeline OCR)
 *   2. Rangée de gabarit libellé → montant (T4, T4A, T5007, RL)
 *   3. Code de case explicite (box_14:, case 14:, 14:)
 *   4. Keywords français et anglais, puis tableaux Markdown Mistral
 */
export function findBoxValueInText(
  ocrText: string,
  box: BoxDef,
): string | null {
  // 0. Stratégies haute-confiance pour les layouts T4A gouvernement canadien.

  // 0a. Section "Other information / Autres renseignements" du T4A gouvernement canadien.
  // OCR.space sort cette section comme:
  //   "Box - Case\nAmount - Montant\n202\n3 000,00\nBox - Case\n203\nAmount - Montant\n2 500,00"
  // On extrait cette section et on cherche le code dedans en PRIORITÉ absolue,
  // avant les stratégies keyword qui débordent dans cette section par erreur.
  const otherInfoStart = ocrText.search(/Other information|Autres renseignements/i);
  if (otherInfoStart >= 0 && box.code.length >= 3) {
    const otherInfoSection = ocrText.slice(otherInfoStart);
    // Chercher "CODE\nMONTANT" ou "CODE\nAmount - Montant\nMONTANT" dans cette section.
    // OCR.space sort parfois "Box - Case\n203\nAmount - Montant\n2 500,00"
    // et parfois "Box - Case\nAmount - Montant\n202\n3 000,00" (ordre variable).
    // On tolère une ligne optionnelle entre le code et le montant.
    const patOther = new RegExp(
      "(?:^|\\n)0*" + box.code + "\\s*\\n(?:[^\\n]{0,40}\\n)?\\s*([0-9][\\d\\s,.']+)",
      "im"
    );
    const mOther = otherInfoSection.match(patOther);
    if (mOther?.[1]) {
      const rawOther = mOther[1].split(/\r?\n/)[0].trim();
      if (!/^\d{3}/.test(rawOther) && parseMontantOCR(rawOther) !== null) return rawOther;
    }
  }

  // 0b. Layout T4A 2-colonnes: "016\n022\n[labels]\n024\n048\nNOM\nMONTANT"
  // OCR.space retourne les codes de cases de gauche (016, 022) séparément des codes de
  // droite (024, 048). La valeur de box_022 (impôt retenu) apparaît APRÈS le nom du
  // bénéficiaire, après les codes 024/048, sous la forme "PRÉNOM\n275,00".
  // Pattern: "016\n022\n" puis (dans les 400 chars) "024\n048\n" puis "PRÉNOM\nMONTANT"
  if (box.code === "022") {
    const t4aLayout = ocrText.match(
      /\b016\b[^\n]*\n[^\n]*\b022\b[\s\S]{0,400}?\b024\b[^\n]*\n[^\n]*\b048\b[^\n]*\n[^\n]{0,40}\n([0-9][\d\s,.']+)/i
    );
    if (t4aLayout?.[1]) {
      const rawVal = t4aLayout[1].split(/\r?\n/)[0].trim();
      if (parseMontantOCR(rawVal) !== null) return rawVal;
    }
  }

  // 0c. Layout T4A 2-colonnes pour box_048 (honoraires):
  // OCR.space sort "024\n048\nPRÉNOM\nMONTANT" — le montant de box_048 est APRÈS le prénom.
  // Pattern: "024\n048\n" puis une ligne de texte (prénom/nom) puis le montant.
  if (box.code === "048") {
    const t4aHono = ocrText.match(
      /\b024\b[^\n]*\n[^\n]*\b048\b[^\n]*\n[^\n]{0,60}\n([0-9][\d\s,.']+)/i
    );
    if (t4aHono?.[1]) {
      const rawVal = t4aHono[1].split(/\r?\n/)[0].trim();
      if (parseMontantOCR(rawVal) !== null) return rawVal;
    }
  }

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
      if (m?.[1] && parseMontantOCR(m[1]) !== null) {
        // Reject if this structured field is labeled as an account/reference number in OCR
        const matchPos = m.index ?? 0;
        const ctxBefore = structText.slice(Math.max(0, matchPos - 120), matchPos);
        if (/(?:account\s+number|numéro\s+de\s+compte|payroll\s+(?:account|program)|compte\s+de\s+retenues)[:\s]*$/i.test(ctxBefore)) continue;
        return m[1].trim();
      }
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
    // Format OCR.space T4A/T4/T5: numéro de case seul sur une ligne, montant sur la suivante
    // ex: "048\n7,212 90" ou "048\n7 212,90"
    new RegExp(`^0*${box.code}\\s*\\r?\\n\\s*([0-9][\\d\\s,.']+)`, "im"),
    // Variante avec espace après le numéro avant le saut de ligne
    new RegExp(`(?:^|\\n)0*${box.code}[ \\t]*\\r?\\n[ \\t]*([0-9][\\d\\s,.']+)`, "im"),
  ];
  for (const pat of codePatterns) {
    const m = ocrText.match(pat);
    if (m?.[1]) {
      // Tronquer au premier newline : un montant ne s'étale jamais sur plusieurs lignes.
      // Ex: "018\n020\n012" capture "020\n012" ; firstLine = "020" → parseMontantOCR null → skip.
      const firstLine = m[1].split(/\r?\n/)[0].trim();
      if (firstLine && parseMontantOCR(firstLine) !== null) return firstLine;
    }
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
  //
  // GARDE SECTION "Other information" du T4A:
  // Si le texte contient une section "Other information / Autres renseignements",
  // on limite la recherche keyword à ce qui précède cette section.
  // Sinon les keywords de box_134 (CELI), box_196, box_024, box_048 capturent
  // les montants de la section "Other information" (202=3000, 203=2500) par erreur.
  const otherInfoBoundary = ocrText.search(/Other information|Autres renseignements/i);
  const searchText = otherInfoBoundary >= 0 ? ocrText.slice(0, otherInfoBoundary) : ocrText;
  const lower = searchText.toLowerCase();
  const MONEY_RE = new RegExp(MONEY_CAPTURE);
  for (const kw of [...new Set([...box.keywords_fr, ...(box.ocrAliases ?? []), ...box.keywords_en])]) {
    const kwLower = kw.toLowerCase();
    const idx = lower.indexOf(kwLower);
    // Éviter que le keyword soit un sous-mot: "150" dans "1500" ou "15000".
    // Vérifier que le caractère après le keyword n’est pas un chiffre.
    if (idx >= 0 && /^\d+$/.test(kw)) {
      const charAfter = lower[idx + kw.length];
      if (charAfter && /\d/.test(charAfter)) continue;
    }
    if (idx >= 0) {
      // IMPORTANT: Pour les keywords purement numériques (code de la case lui-même,
      // ex: "048" pour box_048), on ne cherche la money QU’APRÈS le keyword.
      // Sinon MONEY_RE (qui inclut \s dans son character class) peut capturer
      // "048        410,76" comme un seul token, ce qui donne des faux positifs.
      const isNumericKeyword = /^\d+$/.test(kw);
      const searchStart = isNumericKeyword ? idx + kw.length : idx;
      const after = searchText.slice(searchStart, searchStart + 120);
      // Exclure un match de mot-clé si "redressement pour" précède dans les 80 chars avant.
      // Ce contexte décrit des ajustements historiques, pas la case 10 du T5007.
      const before = searchText.slice(Math.max(0, idx - 80), idx);
      if (/redressement\s+pour/i.test(before)) continue;
      // Exclure contexte "account number" / "numéro de compte" (numeros de compte employé)
      if (/(?:account\s+number|numéro\s+de\s+compte)[:\s]*$/i.test(before)) continue;
      const m = after.match(MONEY_RE);
      if (m?.[1]) {
        // MONEY_RE inclut \s dans son character class, elle peut donc traverser
        // des espaces et des newlines pour capturer un faux gros token comme
        // "048        410,76" ou "15 000,00\n024\n048". On corrige en deux passes :
        //
        // Passe 1 — tronquer au premier newline: un montant monétaire ne s’étale
        // jamais sur plusieurs lignes. Si MONEY_RE a traversé un \n, on ne garde
        // que la première ligne du match (ex: "15 000,00\n024\n..." → "15 000,00").
        const firstLine = m[1].split(/\n/)[0].trim();
        if (!firstLine || parseMontantOCR(firstLine) === null) continue;
        //
        // Passe 2 — rejeter si la valeur commence par un code de case à 3 chiffres
        // suivi d’espaces (ex: "048        410,76"). Cela indique que MONEY_RE a
        // traversé le code d’une autre case vers son montant.
        if (/^\d{3}\s/.test(firstLine)) continue;
        //
        // Exclure les numéros civiques d’adresse (ex: "1547, RUE TREPANIER")
        const matchStart = searchStart + (m.index ?? 0);
        const surroundAfter = searchText.slice(matchStart, matchStart + 50);
        if (/^\d+,?\s+(?:rue|avenue|boul|blvd|chemin|ch\.|place|pl\.|drive|dr\.|road|rd\.)\b/i.test(surroundAfter)) continue;
        // Rejeter si entre la FIN du keyword et le montant il y a un code de case à 3 chiffres
        // (différent de la case courante) — cela indique qu’on a traversé le code d’une
        // autre case et que le montant ne nous appartient pas.
        //
        // Ex1 (multi-ligne): keyword "Annuities" (box_024) → "024\n048\nHEDI\n275,00"
        //     between contient "\n048\n" (code différent de 024) → bloquer.
        // Ex2 (même ligne): T4A layout "024        048        410,76"
        //     keyword "024" → searchStart pointe après "024", between contient "   048   " → bloque.
        //     keyword "048" → searchStart pointe après "048", between contient "   " → OK, retourne 410,76.
        //
        // On cherche TOUT code 3-chiffres dans between, sauf le code de cette case,
        // que ce soit en début de ligne OU séparé par des espaces (layout horizontal T4A).
        const between = after.slice(0, m.index ?? 0);
        const otherCodeInBetween = new RegExp(
          "(?:^|[\\n\\s])0*(?!" + box.code + "\\b)\\d{3}(?:[\\n\\s]|$)"
        );
        if (otherCodeInBetween.test(between)) continue;
        return firstLine;
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
  // IMPORTANT: utiliser [ \t]* au lieu de \s+ pour ne pas traverser plusieurs lignes.
  if (box.code.length >= 3) {
    // 6a. Layout inline "Other information" du T4A gouvernement canadien:
    // tableau horizontal — "202  3 000,00  203  2 500,00" tout sur une seule ligne.
    // OCR.space (isTable=true) sort les cellules séparées par des espaces/tabs,
    // le code de la case est suivi DIRECTEMENT du montant sans retour de ligne.
    // On cherche: début de ligne OU précédé de whitespace, CODE, espaces/tabs, MONTANT,
    // puis soit fin de ligne soit un autre code de case ou du whitespace multiple.
    // Le montant ne doit PAS être suivi d'un chiffre collé (évite de capturer "2022").
    const pat5inline = new RegExp(
      "(?:^|[\\t ])0*" + box.code + "[ \\t]+([0-9][\\d\\s,.']*[0-9])(?=[ \\t]{2,}\\d{3}\\b|[ \\t]*$|[ \\t]*\\r?\\n)",
      "im"
    );
    const m5i = ocrText.match(pat5inline);
    if (m5i?.[1]) {
      const raw5i = m5i[1].trim();
      // Vérifier que ce n'est pas un code de case adjacente capturé par erreur
      if (!/^\d{3}\s/.test(raw5i) && parseMontantOCR(raw5i) !== null) return raw5i;
    }

    const pat5a = new RegExp("\\b0*" + box.code + "[ \\t]*\\n[ \\t]*([0-9][\\d\\s,.']+)", "im");
    const pat5b = new RegExp("\\b0*" + box.code + "\\n([0-9][\\d\\s,.']+)", "im");
    // Pattern pour "CODE\nligne XXXXX\nAMOUNT" (CRA Mon Dossier)
    const pat5c = new RegExp("\\b0*" + box.code + "\\s*\\n(?:ligne?\\s+\\d+[^\\n]*\\n)\\s*([0-9][\\d\\s,.']+)", "im");
    for (const pat5 of [pat5c, pat5a, pat5b]) {
      const m5 = ocrText.match(pat5);
      if (m5?.[1]) {
        // Prendre la première ligne (pas juste le premier token — "7,212 90" a un espace)
        const raw5 = m5[1].split(/\r?\n/)[0].trim();
        // Rejeter si la valeur est précédée d'un libellé "line XXXXX" ou "account number"
        const matchPos = m5.index ?? 0;
        const ctxBefore = ocrText.slice(Math.max(0, matchPos - 60), matchPos + 10);
        if (/\b(?:ligne?|line)\s+\d+\s*$/i.test(ctxBefore)) continue;
        if (/(?:account\s+number|numéro\s+de\s+compte)[:\s]*$/i.test(ctxBefore)) continue;
        // Rejeter si la "valeur" commence par un code de case à 3 chiffres suivi d'un espace
        // (ex: "022 275,00" capturé pour box_016 parce que OCR aligne les cases adjacentes
        // dans le tableau "Autres renseignements" du T4A — on a en réalité capturé le CODE
        // de la case suivante + sa valeur sur la même ligne OCR)
        if (/^\d{3}\s/.test(raw5)) continue;
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
  // Auto-classify if slipCode is "OTHER" or unrecognized — covers docs stored
  // before the classifier was added, or where upload failed to detect the type.
  let resolvedCode = slipCode;
  if (!getSlipDict(slipCode)) {
    resolvedCode = classifySlip(ocrText) ?? slipCode;
  }

  const slip = getSlipDict(resolvedCode);
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
    // Additional markers for T4A / T5 instruction pages
    "Instructions to the payer",
    "Instructions à l'émetteur",
    "Instructions for the recipient",
    "Instructions pour le bénéficiaire",
    "Box 14 — Enter employment income",
    "Case 14 — Entrez les revenus d'emploi",
    "Where to report",
    "Où déclarer",
    // ── Page 2 du T4A CRA (instructions ARC) ──────────────────────────────────
    // La page 2 commence par "Report these amounts on your tax return." (EN)
    // ou "Déclarez ces montants dans votre déclaration de revenus." (FR).
    // Cette page liste TOUTES les cases (Box 016, Box 018, Box 024, Box 032,
    // Box 048…) avec leurs descriptions — l'OCR y trouve les keywords de chaque
    // case et leur assigne la valeur du feuillet, causant des doublons.
    "Report these amounts on your tax return",
    "Déclarez ces montants dans votre déclaration de revenus",
    // Marqueurs RL-1 Revenu Québec (page 2 / bas de page)
    "À l'usage de Revenu Québec",
    "Instructions à l'employé",
    "Feuillet de renseignements",
    "Comment remplir le relevé",
    "Renseignements complémentaires — codes",
    "Ne déclarez pas les renseignements de ce relevé",
    "Pour obtenir des renseignements supplémentaires",
    // Marqueurs RL-2 / autres relevés Revenu Québec
    "Instructions au payeur",
    "Conservez ce feuillet",
  ];
  let cleanText = ocrText;
  for (const marker of INSTRUCTIONS_MARKERS) {
    const idx = cleanText.indexOf(marker);
    if (idx > 200) { // Garder au moins 200 chars pour ne pas tronquer trop tôt
      cleanText = cleanText.slice(0, idx);
      break;
    }
  }

  // Pour RL-1 : pré-parser la structure tabulaire en une passe séquentielle.
  // Cela évite que la valeur de case A (1 482,62) soit absorbée par toutes les
  // autres cases via les patterns keyword/layout qui ne sont pas assez ancrés.
  const isRL1 = /RL-?1\b|Relevé\s+1/i.test(cleanText.slice(0, 1200));
  const rl1Table: Map<string, string> = isRL1 ? parseRL1OcrTable(cleanText) : new Map();

  return slip.boxes.map(box => {
    let rawValue: string | null = null;

    if (box.data_type === "money") {
      // RL-1 : utiliser la table parsée en priorité absolue
      if (isRL1 && rl1Table.size > 0) {
        rawValue = rl1Table.get(box.code) ?? null;
        // Si pas dans la table RL-1, on ne fait PAS de fallback keyword pour RL-1
        // (évite l'absorption inter-cases)
        // Exception: boxes numériques comme 235 qui peuvent avoir d'autres formats
      } else {
        rawValue = findBoxValueInText(cleanText, box);
      }
    }
    const amountCents = rawValue ? parseMontantOCR(rawValue) : null;

    // Confiance: RL-1 table = 85%, structured fields = 92%, keywords = 75%, non trouvé = 0%
    let confidence = 0;
    if (rawValue) {
      if (isRL1 && rl1Table.has(box.code)) {
        confidence = 85;
      } else {
        const structStart = ocrText.indexOf("--- STRUCTURED FIELDS ---");
        if (structStart >= 0) {
          const key = `box_${box.code}`;
          confidence = ocrText.slice(structStart).toLowerCase().includes(key.toLowerCase()) ? 92 : 75;
        } else {
          confidence = 75;
        }
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
