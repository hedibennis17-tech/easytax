/**
 * credits-prestations.ts — v2025.1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * 62 programmes de crédits et prestations — Canada 2025
 * 12 fédéraux + 50 provinciaux/territoriaux · COVID exclu
 * Source: JSON_crédits_et_prestations_2020-2025.json
 *
 * USAGE:
 *   getProgramsForProvince("QC") → programmes fédéraux + programmes QC
 *   getApplicablePrograms(answers, province) → programmes dont l'user est éligible
 *   getCreditLines(province) → lignes T1/TP-1 à remplir pour les crédits
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CreditProgram {
  id: string;
  name_fr: string;
  name_en: string;
  type: "prestation" | "credit_remboursable" | "credit_non_remboursable";
  permanent: boolean;
  years_active: number[];
  frequency: string;
  taxable: boolean;
  t1_line: string | null;
  tp1_line: string | null;
  form: string | null;
  description: string;
  key_amounts: Record<string, unknown>;
  notable_changes: string[];
  uncertainties: string[];
  province?: string; // null = fédéral
}

// ─── Chargement dynamique ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _raw = require("./credits-prestations-2025.json") as {
  federal: CreditProgram[];
  provinces: Record<string, CreditProgram[]>;
};

export const FEDERAL_PROGRAMS: CreditProgram[] = _raw.federal;
export const PROVINCIAL_PROGRAMS: Record<string, CreditProgram[]> = _raw.provinces;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Tous les programmes applicables à une province (fédéraux + provinciaux) */
export function getProgramsForProvince(province: string): CreditProgram[] {
  const provincial = PROVINCIAL_PROGRAMS[province] ?? [];
  return [
    ...FEDERAL_PROGRAMS,
    ...provincial.map(p => ({ ...p, province })),
  ];
}

/** Lignes T1 et TP-1 touchées par les crédits/prestations d'une province */
export function getCreditLines(province: string): { t1: string[]; tp1: string[] } {
  const programs = getProgramsForProvince(province);
  const t1  = [...new Set(programs.filter(p => p.t1_line).map(p => p.t1_line!))];
  const tp1 = [...new Set(programs.filter(p => p.tp1_line).map(p => p.tp1_line!))];
  return { t1, tp1 };
}

/**
 * Détecter les programmes probablement applicables selon les réponses du questionnaire.
 * Retourne les IDs des programmes à afficher en priorité dans la section Crédits.
 */
export function getApplicablePrograms(
  answers: Record<string, unknown>,
  province: string
): CreditProgram[] {
  const allPrograms = getProgramsForProvince(province);
  const applicable: CreditProgram[] = [];

  const hasChildren   = answers["f4"] === true || answers["f4"] === "true";
  const hasSpouse     = ["married", "common_law", "Marié(e)", "Conjoint(e) de fait"].includes(String(answers["f1"] ?? ""));
  const isAine        = answers["c1"] === true || answers["c1"] === "true"; // 65 ans+
  const hasEmployment = answers["t1"] === true || answers["t1"] === "true";
  const hasSelfEmp    = answers["t2"] === true || answers["t2"] === "true";
  const isQC          = province === "QC";
  const hasTuition    = answers["c_tuition"] === true;
  const hasDisability = answers["c5"] === true || answers["c5"] === "true";
  const isRenter      = answers["qc5"] || answers["on1"] || answers["bc1"] || answers["mb1"];

  for (const prog of allPrograms) {
    // Actif en 2025
    if (!prog.years_active.includes(2025)) continue;

    const id = prog.id;

    // Fédéraux universels (tout le monde peut être éligible)
    if (["tps_tvh", "act_cwb", "supp_medical"].includes(id)) {
      applicable.push(prog); continue;
    }

    // ACE — enfants
    if (id === "ace_ccb" && hasChildren) { applicable.push(prog); continue; }

    // Aînés
    if (["sv_oas", "srg_gis"].includes(id) && isAine) { applicable.push(prog); continue; }

    // Handicap
    if (id === "pcph_cdb" && hasDisability) { applicable.push(prog); continue; }

    // Formation
    if (id === "ccf" && (hasEmployment || hasSelfEmp)) { applicable.push(prog); continue; }

    // Rénovation multigén
    if (id === "cirhm") { applicable.push(prog); continue; }

    // Éducateurs
    if (id === "fournitures_educ") { applicable.push(prog); continue; }

    // Incitatif carbone — terminé avril 2025 (ON, MB, SK, NS, PE, NL, YT, NT, NU)
    if (id === "caip_ccr" && !["QC", "BC", "AB", "NB"].includes(province)) {
      applicable.push(prog); continue;
    }

    // QC — programmes selon situation
    if (prog.province === "QC" || (isQC && !prog.province)) {
      if (id === "solidarite") { applicable.push(prog); continue; }
      if (id === "prime_travail" && (hasEmployment || hasSelfEmp)) { applicable.push(prog); continue; }
      if (id === "frais_garde_qc" && hasChildren) { applicable.push(prog); continue; }
      if (id === "bouclier_fiscal" && (hasEmployment || hasSelfEmp)) { applicable.push(prog); continue; }
      if (id === "soutien_aines" && isAine) { applicable.push(prog); continue; }
      if (id === "maintien_domicile" && isAine) { applicable.push(prog); continue; }
      if (id === "allocation_famille_qc" && hasChildren) { applicable.push(prog); continue; }
      if (id === "frais_medicaux_qc") { applicable.push(prog); continue; }
      if (id === "prolongation_carriere" && isAine && hasEmployment) { applicable.push(prog); continue; }
    }

    // ON
    if (prog.province === "ON") {
      if (id === "otb") { applicable.push(prog); continue; }
      if (id === "ocb" && hasChildren) { applicable.push(prog); continue; }
      if (id === "oshptg" && isAine) { applicable.push(prog); continue; }
      if (id === "seniors_care_home" && isAine) { applicable.push(prog); continue; }
    }

    // AB
    if (prog.province === "AB") {
      if (id === "acfb" && hasChildren) { applicable.push(prog); continue; }
      if (id === "ab_affordability") { applicable.push(prog); continue; }
      if (id === "ab_seniors" && isAine) { applicable.push(prog); continue; }
    }

    // BC
    if (prog.province === "BC") {
      if (id === "bc_family" && hasChildren) { applicable.push(prog); continue; }
      if (id === "bccatc") { applicable.push(prog); continue; }
      if (id === "bc_renter") { applicable.push(prog); continue; }
      if (id === "bc_electricity") { applicable.push(prog); continue; }
    }

    // Autres provinces — prestation enfants universelle
    if (["nbctb","nscb","peicb","nlcb","ycb","nwtcb","nucb","cmhb"].includes(id) && hasChildren) {
      applicable.push(prog); continue;
    }
    // Crédits faible revenu provinciaux
    if (["nbhstc","nsaltc","prc","slitc","nt_coltc","nu_coltc","yt_carbone"].includes(id)) {
      applicable.push(prog); continue;
    }
    // Manitoba locataires
    if (id === "rentassist") { applicable.push(prog); continue; }
    // SK
    if (id === "active_families" && hasChildren) { applicable.push(prog); continue; }
  }

  return applicable;
}

/** Résumé d'un programme pour affichage dans la section crédits */
export function formatProgramSummary(prog: CreditProgram, lang: string): {
  name: string;
  description: string;
  type_label: string;
  frequency: string;
  t1_line: string | null;
  tp1_line: string | null;
  is_automatic: boolean;
} {
  const name = lang === "en" ? prog.name_en : prog.name_fr;
  const type_label = prog.type === "prestation"
    ? (lang === "en" ? "Benefit (auto-calculated)" : "Prestation (calcul auto)")
    : prog.type === "credit_remboursable"
      ? (lang === "en" ? "Refundable credit" : "Crédit remboursable")
      : (lang === "en" ? "Non-refundable credit" : "Crédit non remboursable");

  // Prestations versées automatiquement (pas sur la déclaration)
  const is_automatic = prog.type === "prestation" && !prog.t1_line && !prog.tp1_line;

  return {
    name,
    description: prog.description,
    type_label,
    frequency: prog.frequency,
    t1_line: prog.t1_line,
    tp1_line: prog.tp1_line,
    is_automatic,
  };
}
