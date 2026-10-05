/**
 * slip-line-map.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mapping complet case de feuillet → ligne T1 (fédéral) et TP-1 (Québec).
 * Source: declaration-pancanadienne-2025.html (vérifié ARC + Revenu Québec 2025)
 *
 * Utilisé par:
 *   - ocr-to-entries.ts  → savoir où placer chaque champ extrait
 *   - /declaration       → remplir les lignes T1/TP-1 automatiquement
 *   - extracteurs T4/RL-1/etc → annoter chaque champ avec sa destination
 */

export interface LineMapping {
  /** Code du champ dans le feuillet (ex: "box_14", "case_A") */
  fieldCode: string;
  /** Description du champ */
  labelFr: string;
  labelEn: string;
  /** Ligne T1 fédérale (ex: "10100") — null si pas de ligne fédérale directe */
  t1Line: string | null;
  /** Ligne TP-1 québécoise (ex: "101") — null si hors Québec */
  tp1Line: string | null;
  /** Catégorie EasyTax (income/deduction/credit/withheld) */
  entryType: "income" | "deduction" | "credit" | "withheld_federal" | "withheld_provincial" | "info";
  /** Catégorie EasyTax spécifique */
  entryCategory: string;
  /** Si true: le montant génère automatiquement une déduction compensatoire (ex: T5007) */
  autoDeduction?: boolean;
  /** Ligne de la déduction automatique */
  autoDeductionLine?: string;
}

// ════════════════════════════════════════════════════════════════════════════
// T4 — Rémunération payée
// Référence: RC4120 (ARC 2025)
// ════════════════════════════════════════════════════════════════════════════
export const T4_MAP: Record<string, LineMapping> = {
  box_14: {
    fieldCode: "box_14", labelFr: "Revenus d'emploi", labelEn: "Employment income",
    t1Line: "10100", tp1Line: "101",
    entryType: "income", entryCategory: "employment",
  },
  box_16: {
    fieldCode: "box_16", labelFr: "Cotisations de l'employé au RPC/RRQ", labelEn: "Employee CPP/QPP contributions",
    t1Line: "30800", tp1Line: null, // crédit non remboursable
    entryType: "credit", entryCategory: "cpp_employee",
  },
  box_18: {
    fieldCode: "box_18", labelFr: "Cotisations de l'employé à l'AE", labelEn: "Employee EI premiums",
    t1Line: "31200", tp1Line: null,
    entryType: "credit", entryCategory: "ei_employee",
  },
  box_20: {
    fieldCode: "box_20", labelFr: "Avantages imposables", labelEn: "Taxable benefits",
    t1Line: "10100", tp1Line: "101", // s'ajoute aux revenus d'emploi
    entryType: "income", entryCategory: "employment",
  },
  box_22: {
    fieldCode: "box_22", labelFr: "Impôt sur le revenu retenu", labelEn: "Income tax deducted",
    t1Line: "43700", tp1Line: null,
    entryType: "withheld_federal", entryCategory: "federal_tax_withheld",
  },
  box_24: {
    fieldCode: "box_24", labelFr: "Gains assurables aux fins de l'AE", labelEn: "EI insurable earnings",
    t1Line: null, tp1Line: null,
    entryType: "info", entryCategory: "ei_insurable_earnings",
  },
  box_26: {
    fieldCode: "box_26", labelFr: "Gains ouvrant droit à pension au RPC/RRQ", labelEn: "CPP/QPP pensionable earnings",
    t1Line: null, tp1Line: null,
    entryType: "info", entryCategory: "cpp_pensionable_earnings",
  },
  box_44: {
    fieldCode: "box_44", labelFr: "Cotisations syndicales", labelEn: "Union dues",
    t1Line: "21200", tp1Line: "210",
    entryType: "deduction", entryCategory: "union_dues",
  },
  box_46: {
    fieldCode: "box_46", labelFr: "Dons de bienfaisance", labelEn: "Charitable donations",
    t1Line: "34900", tp1Line: "395",
    entryType: "credit", entryCategory: "donations",
  },
  box_52: {
    fieldCode: "box_52", labelFr: "Facteur d'équivalence", labelEn: "Pension adjustment",
    t1Line: null, tp1Line: null,
    entryType: "info", entryCategory: "pension_adjustment",
  },
  employer_name: {
    fieldCode: "employer_name", labelFr: "Nom de l'employeur", labelEn: "Employer name",
    t1Line: null, tp1Line: null,
    entryType: "info", entryCategory: "employer_name",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// RL-1 — Relevé 1 (Québec) — Revenus d'emploi et revenus divers
// Référence: IN-253 (Revenu Québec 2025)
// ════════════════════════════════════════════════════════════════════════════
export const RL1_MAP: Record<string, LineMapping> = {
  case_A: {
    fieldCode: "case_A", labelFr: "Revenus d'emploi", labelEn: "Employment income",
    t1Line: "10100", tp1Line: "101",
    entryType: "income", entryCategory: "employment",
  },
  case_B: {
    fieldCode: "case_B", labelFr: "Cotisations au RRQ", labelEn: "QPP contributions",
    t1Line: "30800", tp1Line: "206",
    entryType: "credit", entryCategory: "rrq_employee",
  },
  case_C: {
    fieldCode: "case_C", labelFr: "Cotisations au RQAP", labelEn: "QPIP premiums",
    t1Line: "31205", tp1Line: "375",
    entryType: "credit", entryCategory: "rqap_employee",
  },
  case_D: {
    fieldCode: "case_D", labelFr: "Cotisations syndicales", labelEn: "Union dues",
    t1Line: "21200", tp1Line: "210",
    entryType: "deduction", entryCategory: "union_dues",
  },
  case_E: {
    fieldCode: "case_E", labelFr: "Impôt du Québec retenu", labelEn: "Quebec income tax withheld",
    t1Line: null, tp1Line: "451",
    entryType: "withheld_provincial", entryCategory: "provincial_tax_withheld",
  },
  case_G: {
    fieldCode: "case_G", labelFr: "Salaire admissible au RRQ", labelEn: "QPP admissible salary",
    t1Line: null, tp1Line: null,
    entryType: "info", entryCategory: "rrq_admissible_salary",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// T4A — Pensions, retraite, rentes et autres revenus
// ════════════════════════════════════════════════════════════════════════════
export const T4A_MAP: Record<string, LineMapping> = {
  box_016: {
    fieldCode: "box_016", labelFr: "Pension ou rente de retraite", labelEn: "Pension or superannuation",
    t1Line: "11500", tp1Line: "111",
    entryType: "income", entryCategory: "pension",
  },
  box_018: {
    fieldCode: "box_018", labelFr: "Paiement forfaitaire rétroactif", labelEn: "Lump-sum retroactive payment",
    t1Line: "13000", tp1Line: "154",
    entryType: "income", entryCategory: "other_income",
  },
  box_020: {
    fieldCode: "box_020", labelFr: "Commissions de travail indépendant", labelEn: "Self-employment commissions",
    t1Line: "13900", tp1Line: "164",
    entryType: "income", entryCategory: "self_employment",
  },
  box_022: {
    fieldCode: "box_022", labelFr: "Impôt retenu (T4A)", labelEn: "Income tax deducted (T4A)",
    t1Line: "43700", tp1Line: "451",
    entryType: "withheld_federal", entryCategory: "federal_tax_withheld",
  },
  box_024: {
    fieldCode: "box_024", labelFr: "Rentes", labelEn: "Annuities",
    t1Line: "13000", tp1Line: "154",
    entryType: "income", entryCategory: "other_income",
  },
  box_048: {
    fieldCode: "box_048", labelFr: "Honoraires ou autres sommes pour services", labelEn: "Fees or other amounts for services",
    t1Line: "13500", tp1Line: "164", // revenu d'entreprise
    entryType: "income", entryCategory: "self_employment",
  },
  box_105: {
    fieldCode: "box_105", labelFr: "Bourses d'études (partie imposable)", labelEn: "Scholarships (taxable portion)",
    t1Line: "13010", tp1Line: "154",
    entryType: "income", entryCategory: "scholarships",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// T4A(P) — RPC/RRQ
// ════════════════════════════════════════════════════════════════════════════
export const T4AP_MAP: Record<string, LineMapping> = {
  box_16: {
    fieldCode: "box_16", labelFr: "Prestations de retraite RPC/RRQ", labelEn: "CPP/QPP retirement benefits",
    t1Line: "11400", tp1Line: "114",
    entryType: "income", entryCategory: "cpp_benefits",
  },
  box_20: {
    fieldCode: "box_20", labelFr: "Prestations d'invalidité RPC/RRQ", labelEn: "CPP/QPP disability benefits",
    t1Line: "11400", tp1Line: "114",
    entryType: "income", entryCategory: "cpp_benefits",
  },
  box_22: {
    fieldCode: "box_22", labelFr: "Impôt retenu (T4A-P)", labelEn: "Income tax deducted (T4A-P)",
    t1Line: "43700", tp1Line: "451",
    entryType: "withheld_federal", entryCategory: "federal_tax_withheld",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// T4A(OAS) — Sécurité de la vieillesse
// ════════════════════════════════════════════════════════════════════════════
export const T4AOAS_MAP: Record<string, LineMapping> = {
  box_18: {
    fieldCode: "box_18", labelFr: "Pension de la Sécurité de la vieillesse", labelEn: "Old Age Security pension",
    t1Line: "11300", tp1Line: "114",
    entryType: "income", entryCategory: "oas",
  },
  box_21: {
    fieldCode: "box_21", labelFr: "Supplément de revenu garanti (SRG)", labelEn: "Guaranteed Income Supplement",
    t1Line: "14600", tp1Line: null, // non imposable
    entryType: "income", entryCategory: "gis",
  },
  box_22: {
    fieldCode: "box_22", labelFr: "Impôt retenu (SV)", labelEn: "Income tax deducted (OAS)",
    t1Line: "43700", tp1Line: "451",
    entryType: "withheld_federal", entryCategory: "federal_tax_withheld",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// T4E — Assurance-emploi
// ════════════════════════════════════════════════════════════════════════════
export const T4E_MAP: Record<string, LineMapping> = {
  box_14: {
    fieldCode: "box_14", labelFr: "Prestations d'assurance-emploi", labelEn: "Employment insurance benefits",
    t1Line: "11900", tp1Line: "154",
    entryType: "income", entryCategory: "ei_benefits",
  },
  box_22: {
    fieldCode: "box_22", labelFr: "Impôt retenu (T4E)", labelEn: "Income tax deducted (T4E)",
    t1Line: "43700", tp1Line: "451",
    entryType: "withheld_federal", entryCategory: "federal_tax_withheld",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// T4RSP — Retrait REER
// ════════════════════════════════════════════════════════════════════════════
export const T4RSP_MAP: Record<string, LineMapping> = {
  box_16: {
    fieldCode: "box_16", labelFr: "Somme retirée du REER", labelEn: "RRSP amount withdrawn",
    t1Line: "12900", tp1Line: "122",
    entryType: "income", entryCategory: "rrsp_withdrawal",
  },
  box_22: {
    fieldCode: "box_22", labelFr: "Impôt retenu (REER)", labelEn: "Income tax deducted (RRSP)",
    t1Line: "43700", tp1Line: "451",
    entryType: "withheld_federal", entryCategory: "federal_tax_withheld",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// T5 — Revenus de placements
// ════════════════════════════════════════════════════════════════════════════
export const T5_MAP: Record<string, LineMapping> = {
  box_10: {
    fieldCode: "box_10", labelFr: "Dividendes de sociétés canadiennes imposables (ordinaires)", labelEn: "Actual amount of dividends (non-eligible)",
    t1Line: "12000", tp1Line: "128",
    entryType: "income", entryCategory: "dividends_ineligible",
  },
  box_11: {
    fieldCode: "box_11", labelFr: "Dividendes déterminés (montant majoré)", labelEn: "Taxable amount of eligible dividends",
    t1Line: "12000", tp1Line: "128",
    entryType: "income", entryCategory: "dividends_eligible",
  },
  box_13: {
    fieldCode: "box_13", labelFr: "Intérêts et autres revenus de placements", labelEn: "Interest from Canadian sources",
    t1Line: "12100", tp1Line: "130",
    entryType: "income", entryCategory: "interest",
  },
  box_24: {
    fieldCode: "box_24", labelFr: "Dividendes déterminés (montant réel)", labelEn: "Actual amount of eligible dividends",
    t1Line: "12000", tp1Line: "128",
    entryType: "income", entryCategory: "dividends_eligible",
  },
  box_25: {
    fieldCode: "box_25", labelFr: "Dividendes ordinaires (montant réel)", labelEn: "Actual amount of non-eligible dividends",
    t1Line: "12000", tp1Line: "128",
    entryType: "income", entryCategory: "dividends_ineligible",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// T5007 — Indemnités (CNESST, accident du travail, assistance sociale)
// ⚠️ Inclus dans le revenu (14400) ET déduit intégralement (25000) → net = 0
// ════════════════════════════════════════════════════════════════════════════
export const T5007_MAP: Record<string, LineMapping> = {
  box_10: {
    fieldCode: "box_10", labelFr: "Indemnités de remplacement du revenu", labelEn: "Social assistance or workers comp",
    t1Line: "14400", tp1Line: "148",
    entryType: "income", entryCategory: "workers_comp",
    autoDeduction: true, autoDeductionLine: "25000",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// T2202 — Frais de scolarité
// ════════════════════════════════════════════════════════════════════════════
export const T2202_MAP: Record<string, LineMapping> = {
  case_A: {
    fieldCode: "case_A", labelFr: "Frais de scolarité admissibles", labelEn: "Eligible tuition fees",
    t1Line: "32300", tp1Line: "398",
    entryType: "credit", entryCategory: "tuition",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// T5008 — Opérations sur titres (gains en capital)
// ════════════════════════════════════════════════════════════════════════════
export const T5008_MAP: Record<string, LineMapping> = {
  box_20: {
    fieldCode: "box_20", labelFr: "Prix de base rajusté", labelEn: "Cost or book value",
    t1Line: null, tp1Line: null,
    entryType: "info", entryCategory: "capital_cost_base",
  },
  box_21: {
    fieldCode: "box_21", labelFr: "Produit de disposition", labelEn: "Proceeds of disposition",
    t1Line: "12700", tp1Line: "139", // 50% du gain net
    entryType: "income", entryCategory: "capital_gains",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// RL-2 — Relevé 2 Québec (REER/FERR)
// ════════════════════════════════════════════════════════════════════════════
export const RL2_MAP: Record<string, LineMapping> = {
  case_A: {
    fieldCode: "case_A", labelFr: "Rentes et autres revenus", labelEn: "Annuities and other income",
    t1Line: "11500", tp1Line: "111",
    entryType: "income", entryCategory: "pension",
  },
  case_C: {
    fieldCode: "case_C", labelFr: "Impôt du Québec retenu (RL-2)", labelEn: "Quebec tax withheld (RL-2)",
    t1Line: null, tp1Line: "451",
    entryType: "withheld_provincial", entryCategory: "provincial_tax_withheld",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// RL-5 — Relevé 5 Québec (CNESST / indemnités)
// ⚠️ Case C → lignes 148 (revenu) ET 295 (déduction automatique)
// ════════════════════════════════════════════════════════════════════════════
export const RL5_MAP: Record<string, LineMapping> = {
  case_C: {
    fieldCode: "case_C", labelFr: "Indemnités de remplacement du revenu (CNESST)", labelEn: "Income replacement benefits",
    t1Line: "14400", tp1Line: "148",
    entryType: "income", entryCategory: "workers_comp",
    autoDeduction: true, autoDeductionLine: "295",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// REÇU REER — Cotisation REER
// ════════════════════════════════════════════════════════════════════════════
export const REER_MAP: Record<string, LineMapping> = {
  amount: {
    fieldCode: "amount", labelFr: "Cotisation REER / CELIAPP", labelEn: "RRSP / FHSA contribution",
    t1Line: "20800", tp1Line: "208",
    entryType: "deduction", entryCategory: "rrsp",
  },
};

// ════════════════════════════════════════════════════════════════════════════
// REGISTRE COMPLET — lookup par type de document
// ════════════════════════════════════════════════════════════════════════════
export const SLIP_LINE_MAPS: Record<string, Record<string, LineMapping>> = {
  "T4":        T4_MAP,
  "RL-1":      RL1_MAP,
  "T4A":       T4A_MAP,
  "T4A(P)":    T4AP_MAP,
  "T4A(OAS)":  T4AOAS_MAP,
  "T4E":       T4E_MAP,
  "T4RSP":     T4RSP_MAP,
  "T5":        T5_MAP,
  "T5007":     T5007_MAP,
  "T2202":     T2202_MAP,
  "T5008":     T5008_MAP,
  "RL-2":      RL2_MAP,
  "RL-5":      RL5_MAP,
  "REER":      REER_MAP,
};

/**
 * Obtenir le mapping pour un code de champ OCR et un type de document.
 * @param slipType  "T4" | "RL-1" | etc.
 * @param fieldCode "box_14" | "case_A" | etc.
 */
export function getLineMapping(slipType: string, fieldCode: string): LineMapping | null {
  const map = SLIP_LINE_MAPS[slipType];
  if (!map) return null;
  return map[fieldCode] ?? null;
}

/**
 * Retourner tous les mappings d'un type de document.
 */
export function getSlipMappings(slipType: string): Record<string, LineMapping> {
  return SLIP_LINE_MAPS[slipType] ?? {};
}

/**
 * Lignes T1 clés avec leurs descriptions — pour la page déclaration
 */
export const T1_LINES: Record<string, { labelFr: string; labelEn: string; section: string }> = {
  // REVENUS
  "10100": { labelFr: "Revenus d'emploi", labelEn: "Employment income", section: "revenus" },
  "11300": { labelFr: "Pension de la Sécurité de la vieillesse (SV)", labelEn: "Old Age Security pension", section: "revenus" },
  "11400": { labelFr: "Prestations du RPC/RRQ", labelEn: "CPP/QPP benefits", section: "revenus" },
  "11500": { labelFr: "Autres pensions et rentes", labelEn: "Other pensions and superannuation", section: "revenus" },
  "11900": { labelFr: "Prestations d'assurance-emploi", labelEn: "Employment insurance benefits", section: "revenus" },
  "12000": { labelFr: "Dividendes de sociétés canadiennes imposables", labelEn: "Taxable dividends", section: "revenus" },
  "12100": { labelFr: "Intérêts et autres revenus de placements", labelEn: "Interest and investment income", section: "revenus" },
  "12600": { labelFr: "Revenus nets de location", labelEn: "Net rental income", section: "revenus" },
  "12700": { labelFr: "Gains en capital imposables", labelEn: "Taxable capital gains", section: "revenus" },
  "12900": { labelFr: "Revenus REER", labelEn: "RRSP income", section: "revenus" },
  "13000": { labelFr: "Autres revenus", labelEn: "Other income", section: "revenus" },
  "13010": { labelFr: "Bourses (partie imposable)", labelEn: "Scholarships (taxable portion)", section: "revenus" },
  "13500": { labelFr: "Revenus nets d'entreprise (T2125)", labelEn: "Net business income", section: "revenus" },
  "14400": { labelFr: "Indemnités de travailleur (T5007)", labelEn: "Workers comp (T5007)", section: "revenus" },
  "15000": { labelFr: "Revenu total", labelEn: "Total income", section: "total", bold: true } as { labelFr: string; labelEn: string; section: string; bold: boolean },
  // DÉDUCTIONS
  "20600": { labelFr: "Cotisation au RPC/RRQ sur revenus autonome", labelEn: "CPP/QPP on self-employment", section: "deductions" },
  "20800": { labelFr: "Déduction pour REER / CELIAPP", labelEn: "RRSP/FHSA deduction", section: "deductions" },
  "21200": { labelFr: "Cotisations syndicales / professionnelles", labelEn: "Union/professional dues", section: "deductions" },
  "21400": { labelFr: "Frais de garde d'enfants", labelEn: "Child care expenses", section: "deductions" },
  "22100": { labelFr: "Frais financiers et intérêts déductibles", labelEn: "Carrying charges and interest", section: "deductions" },
  "22900": { labelFr: "Dépenses d'emploi (T2200)", labelEn: "Employment expenses (T2200)", section: "deductions" },
  "23200": { labelFr: "Autres déductions", labelEn: "Other deductions", section: "deductions" },
  "25000": { labelFr: "Déduction pour T5007 (indemnités)", labelEn: "T5007 deduction", section: "deductions" },
  "23600": { labelFr: "Revenu net", labelEn: "Net income", section: "total", bold: true } as { labelFr: string; labelEn: string; section: string; bold: boolean },
  "26000": { labelFr: "Revenu imposable", labelEn: "Taxable income", section: "total", bold: true } as { labelFr: string; labelEn: string; section: string; bold: boolean },
  // CRÉDITS
  "30000": { labelFr: "Montant personnel de base (16 129 $)", labelEn: "Basic personal amount", section: "credits" },
  "30800": { labelFr: "Cotisations RPC/RRQ (emploi)", labelEn: "CPP/QPP contributions (employment)", section: "credits" },
  "31200": { labelFr: "Cotisations à l'AE", labelEn: "EI premiums", section: "credits" },
  "31260": { labelFr: "Montant canadien pour emploi", labelEn: "Canada employment amount", section: "credits" },
  "32300": { labelFr: "Frais de scolarité (T2202)", labelEn: "Tuition (T2202)", section: "credits" },
  "33099": { labelFr: "Frais médicaux", labelEn: "Medical expenses", section: "credits" },
  "34900": { labelFr: "Dons de bienfaisance", labelEn: "Charitable donations", section: "credits" },
  // RETENUES ET SOLDE
  "43700": { labelFr: "Total de l'impôt retenu", labelEn: "Total income tax deducted", section: "withheld" },
  "47600": { labelFr: "Acomptes provisionnels payés", labelEn: "Tax instalments paid", section: "withheld" },
};

/**
 * Lignes TP-1 clés (Québec)
 */
export const TP1_LINES: Record<string, { labelFr: string; section: string }> = {
  "101":  { labelFr: "Revenus d'emploi (RL-1 case A)", section: "revenus" },
  "111":  { labelFr: "Revenus de retraite (RL-2 case A)", section: "revenus" },
  "114":  { labelFr: "Rentes du gouvernement (RPC/RRQ/SV)", section: "revenus" },
  "122":  { labelFr: "Retraits REER (RL-2)", section: "revenus" },
  "128":  { labelFr: "Revenus de placements (RL-3)", section: "revenus" },
  "130":  { labelFr: "Intérêts", section: "revenus" },
  "139":  { labelFr: "Gains en capital", section: "revenus" },
  "148":  { labelFr: "Indemnités (RL-5 case C)", section: "revenus" },
  "154":  { labelFr: "Autres revenus", section: "revenus" },
  "164":  { labelFr: "Revenus d'entreprise nets (annexe L)", section: "revenus" },
  "199":  { labelFr: "Revenu total", section: "total" },
  "206":  { labelFr: "Cotisations RRQ — emploi (RL-1 case B)", section: "deductions" },
  "207":  { labelFr: "Autres déductions", section: "deductions" },
  "208":  { labelFr: "Cotisations REER", section: "deductions" },
  "210":  { labelFr: "Cotisations syndicales (RL-1 case D)", section: "deductions" },
  "214":  { labelFr: "Frais de garde", section: "deductions" },
  "225":  { labelFr: "Pension alimentaire payée", section: "deductions" },
  "231":  { labelFr: "Frais financiers", section: "deductions" },
  "246":  { labelFr: "Remboursement de sommes", section: "deductions" },
  "248":  { labelFr: "Revenu net", section: "total" },
  "295":  { labelFr: "Déduction RL-5 case C", section: "deductions" },
  "299":  { labelFr: "Revenu imposable", section: "total" },
  "350":  { labelFr: "Montant personnel de base (18 571 $)", section: "credits" },
  "361":  { labelFr: "Montant en raison de l'âge", section: "credits" },
  "375":  { labelFr: "Cotisations RQAP", section: "credits" },
  "381":  { labelFr: "Frais médicaux", section: "credits" },
  "395":  { labelFr: "Dons de bienfaisance", section: "credits" },
  "398":  { labelFr: "Frais de scolarité (RL-8)", section: "credits" },
  "430":  { labelFr: "Cotisation RRQ — travail autonome", section: "other" },
  "442":  { labelFr: "Cotisation RQAP — travail autonome", section: "other" },
  "451":  { labelFr: "Impôt du Québec retenu (RL-1 case E)", section: "withheld" },
  "460":  { labelFr: "Acomptes provisionnels", section: "withheld" },
};
