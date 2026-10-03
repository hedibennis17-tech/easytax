/**
 * questionnaire-engine.ts — Moteur de questionnaire intelligent
 *
 * RÈGLES FONDAMENTALES :
 * - Un INDIVIDUAL ne voit JAMAIS de questions BUSINESS
 * - Les modules s'activent dynamiquement selon les réponses
 * - La progression est recalculée à chaque réponse
 * - Les données OCR ne sont pas automatiquement validées
 */

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type AccountType = "INDIVIDUAL" | "BUSINESS" | "ALL";
export type ModuleCode =
  | "EMPLOYMENT" | "EMPLOYMENT_MULTIPLE"
  | "SELF_EMPLOYED" | "SELF_EMPLOYED_UBER" | "SELF_EMPLOYED_LYFT"
  | "RENTAL" | "INVESTMENT" | "CRYPTO"
  | "FOREIGN_INCOME" | "FAMILY" | "PENSION"
  | "RRSP" | "HOME_OFFICE" | "VEHICLE";

export type QuestionStatus =
  | "NOT_STARTED" | "ANSWERED" | "SKIPPED"
  | "NOT_APPLICABLE" | "NEEDS_REVIEW" | "VALIDATED";

export interface QuestionDef {
  code: string;
  section: string;
  textFr: string;
  textEn: string;
  hintFr?: string;
  hintEn?: string;
  type: string;
  required: boolean;
  accountType: AccountType;
  moduleCode?: ModuleCode;      // module qui doit être actif pour afficher
  activatesModule?: ModuleCode; // module que cette réponse active si OUI
  showIf?: string;              // code de question parent (réponse = true)
  showIfValue?: string;         // valeur spécifique attendue
  documentRequired?: string;   // code du document que cette question déclenche
}

// ─── DÉFINITION COMPLÈTE DES QUESTIONS ───────────────────────────────────────
// Source unique de vérité — NE PAS afficher les BUSINESS aux INDIVIDUAL

export const QUESTION_DEFINITIONS: QuestionDef[] = [
  // ── IDENTITÉ ────────────────────────────────────────────────────────────────
  {
    code: "confirm_residence_province",
    section: "identity",
    textFr: "Confirmez-vous résider au Québec au 31 décembre 2025 ?",
    textEn: "Do you confirm residing in Quebec on December 31, 2025?",
    hintFr: "Votre province de résidence détermine votre déclaration provinciale",
    hintEn: "Your province of residence determines your provincial return",
    type: "BOOLEAN",
    required: true,
    accountType: "INDIVIDUAL",
  },
  {
    code: "marital_status_changed",
    section: "identity",
    textFr: "Votre situation matrimoniale a-t-elle changé en 2025 ?",
    textEn: "Did your marital status change in 2025?",
    hintFr: "Mariage, séparation, divorce, début d'union de fait",
    hintEn: "Marriage, separation, divorce, common-law start",
    type: "BOOLEAN",
    required: true,
    accountType: "INDIVIDUAL",
  },

  // ── EMPLOI ──────────────────────────────────────────────────────────────────
  {
    code: "has_employment_income",
    section: "employment",
    textFr: "Avez-vous eu un revenu d'emploi en 2025 ?",
    textEn: "Did you have employment income in 2025?",
    hintFr: "Salaires, traitements, pourboires, commissions, avantages imposables",
    hintEn: "Wages, salary, tips, commissions, taxable benefits",
    type: "BOOLEAN",
    required: true,
    accountType: "INDIVIDUAL",
    activatesModule: "EMPLOYMENT",
    documentRequired: "T4",
  },
  {
    code: "num_employers",
    section: "employment",
    textFr: "Combien d'employeurs avez-vous eu en 2025 ?",
    textEn: "How many employers did you have in 2025?",
    hintFr: "Incluez les emplois à temps partiel, saisonniers ou temporaires",
    hintEn: "Include part-time, seasonal or temporary jobs",
    type: "NUMBER",
    required: true,
    accountType: "INDIVIDUAL",
    moduleCode: "EMPLOYMENT",
    showIf: "has_employment_income",
    activatesModule: "EMPLOYMENT_MULTIPLE",
  },
  {
    code: "worked_from_home",
    section: "employment",
    textFr: "Avez-vous travaillé de la maison en 2025 ?",
    textEn: "Did you work from home in 2025?",
    hintFr: "Vous pourriez avoir droit à des déductions pour bureau à domicile",
    hintEn: "You may be eligible for home office deductions",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    moduleCode: "EMPLOYMENT",
    showIf: "has_employment_income",
    activatesModule: "HOME_OFFICE",
  },
  {
    code: "employment_expenses_t2200",
    section: "employment",
    textFr: "Votre employeur vous a-t-il remis un formulaire T2200 (Conditions d'emploi) ?",
    textEn: "Did your employer provide a T2200 (Declaration of Conditions of Employment)?",
    hintFr: "Ce formulaire est nécessaire pour déduire des dépenses d'emploi",
    hintEn: "This form is required to deduct employment expenses",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    moduleCode: "HOME_OFFICE",
    showIf: "worked_from_home",
    documentRequired: "T2200",
  },

  // ── TRAVAIL AUTONOME ─────────────────────────────────────────────────────────
  {
    code: "has_self_employment",
    section: "self_employment",
    textFr: "Avez-vous eu des revenus de travail autonome ou d'entreprise individuelle en 2025 ?",
    textEn: "Did you have self-employment or sole proprietorship income in 2025?",
    hintFr: "Freelance, contrats, livraison, consultation, vente de biens ou services",
    hintEn: "Freelance, contracts, delivery, consulting, selling goods or services",
    type: "BOOLEAN",
    required: true,
    accountType: "INDIVIDUAL",
    activatesModule: "SELF_EMPLOYED",
  },
  {
    code: "self_employment_type",
    section: "self_employment",
    textFr: "Quel type d'activité autonome avez-vous exercé ?",
    textEn: "What type of self-employment activity did you have?",
    hintFr: "Sélectionnez tout ce qui s'applique",
    hintEn: "Select all that apply",
    type: "MULTIPLE_CHOICE",
    required: true,
    accountType: "INDIVIDUAL",
    moduleCode: "SELF_EMPLOYED",
    showIf: "has_self_employment",
  },
  {
    code: "self_employment_gross_revenue",
    section: "self_employment",
    textFr: "Quel était votre revenu brut total de travail autonome en 2025 ?",
    textEn: "What was your total gross self-employment revenue in 2025?",
    hintFr: "Avant déduction des dépenses",
    hintEn: "Before expenses",
    type: "MONEY",
    required: true,
    accountType: "INDIVIDUAL",
    moduleCode: "SELF_EMPLOYED",
    showIf: "has_self_employment",
  },
  {
    code: "self_employment_vehicle",
    section: "self_employment",
    textFr: "Avez-vous utilisé un véhicule pour votre travail autonome ?",
    textEn: "Did you use a vehicle for your self-employment?",
    hintFr: "Les frais d'automobile peuvent être déductibles au prorata de l'usage professionnel",
    hintEn: "Vehicle expenses may be deductible proportionally to business use",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    moduleCode: "SELF_EMPLOYED",
    showIf: "has_self_employment",
    activatesModule: "VEHICLE",
  },
  {
    code: "vehicle_business_km",
    section: "self_employment",
    textFr: "Combien de kilomètres avez-vous parcourus pour affaires en 2025 ?",
    textEn: "How many kilometers did you drive for business in 2025?",
    type: "NUMBER",
    required: true,
    accountType: "INDIVIDUAL",
    moduleCode: "VEHICLE",
    showIf: "self_employment_vehicle",
  },
  {
    code: "vehicle_total_km",
    section: "self_employment",
    textFr: "Combien de kilomètres avez-vous parcourus en tout (affaires + personnel) ?",
    textEn: "What was your total mileage (business + personal)?",
    type: "NUMBER",
    required: true,
    accountType: "INDIVIDUAL",
    moduleCode: "VEHICLE",
    showIf: "self_employment_vehicle",
  },
  {
    code: "self_employment_home_office",
    section: "self_employment",
    textFr: "Utilisez-vous une partie de votre domicile exclusivement pour votre activité autonome ?",
    textEn: "Do you use part of your home exclusively for your self-employment?",
    hintFr: "Vous pourriez déduire une partie de votre loyer ou de vos frais de domicile",
    hintEn: "You may deduct a portion of your rent or home expenses",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    moduleCode: "SELF_EMPLOYED",
    showIf: "has_self_employment",
  },
  {
    code: "has_gst_hst_account",
    section: "self_employment",
    textFr: "Avez-vous un compte TPS/TVH ou TVQ enregistré ?",
    textEn: "Do you have a registered GST/HST or QST account?",
    hintFr: "Obligatoire si vos revenus annuels dépassent 30 000 $ sur 4 trimestres",
    hintEn: "Required if your annual revenue exceeds $30,000 over 4 quarters",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    moduleCode: "SELF_EMPLOYED",
    showIf: "has_self_employment",
  },

  // ── REVENUS DE PLACEMENT ─────────────────────────────────────────────────────
  {
    code: "has_investment_income",
    section: "investment",
    textFr: "Avez-vous eu des revenus de placement en 2025 ?",
    textEn: "Did you have investment income in 2025?",
    hintFr: "Intérêts, dividendes, gains en capital, T5, T3",
    hintEn: "Interest, dividends, capital gains, T5, T3",
    type: "BOOLEAN",
    required: true,
    accountType: "INDIVIDUAL",
    activatesModule: "INVESTMENT",
    documentRequired: "T5",
  },
  {
    code: "has_capital_gains",
    section: "investment",
    textFr: "Avez-vous vendu des placements, actions ou biens en 2025 ?",
    textEn: "Did you sell investments, shares or property in 2025?",
    hintFr: "Cessions génèrent des gains ou pertes en capital",
    hintEn: "Disposals generate capital gains or losses",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    moduleCode: "INVESTMENT",
    showIf: "has_investment_income",
    documentRequired: "T5008",
  },
  {
    code: "has_crypto",
    section: "investment",
    textFr: "Avez-vous effectué des transactions en cryptomonnaies en 2025 ?",
    textEn: "Did you make cryptocurrency transactions in 2025?",
    hintFr: "Achat, vente, échange ou minage de cryptomonnaies",
    hintEn: "Buying, selling, exchanging or mining cryptocurrencies",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    activatesModule: "CRYPTO",
  },

  // ── LOCATION ────────────────────────────────────────────────────────────────
  {
    code: "has_rental_income",
    section: "investment",
    textFr: "Avez-vous eu des revenus de location en 2025 ?",
    textEn: "Did you have rental income in 2025?",
    hintFr: "Location d'appartement, chambre, chalet, Airbnb, local commercial",
    hintEn: "Apartment, room, cottage, Airbnb, commercial space rental",
    type: "BOOLEAN",
    required: true,
    accountType: "INDIVIDUAL",
    activatesModule: "RENTAL",
  },
  {
    code: "num_rental_properties",
    section: "investment",
    textFr: "Combien de propriétés avez-vous louées en 2025 ?",
    textEn: "How many properties did you rent out in 2025?",
    type: "NUMBER",
    required: true,
    accountType: "INDIVIDUAL",
    moduleCode: "RENTAL",
    showIf: "has_rental_income",
  },
  {
    code: "rental_gross_income",
    section: "investment",
    textFr: "Quel était votre revenu brut total de location en 2025 ?",
    textEn: "What was your total gross rental income in 2025?",
    type: "MONEY",
    required: true,
    accountType: "INDIVIDUAL",
    moduleCode: "RENTAL",
    showIf: "has_rental_income",
  },

  // ── DÉDUCTIONS ──────────────────────────────────────────────────────────────
  {
    code: "has_rrsp_contribution",
    section: "deductions",
    textFr: "Avez-vous cotisé à un REER en 2025 ou entre le 1er janvier et le 3 mars 2026 ?",
    textEn: "Did you contribute to an RRSP in 2025 or between January 1 and March 3, 2026?",
    hintFr: "Les cotisations REER réduisent directement votre revenu imposable",
    hintEn: "RRSP contributions directly reduce your taxable income",
    type: "BOOLEAN",
    required: true,
    accountType: "INDIVIDUAL",
    activatesModule: "RRSP",
    documentRequired: "RRSP_RECEIPT",
  },
  {
    code: "rrsp_contribution_amount",
    section: "deductions",
    textFr: "Quel montant total avez-vous cotisé à votre REER ?",
    textEn: "What total amount did you contribute to your RRSP?",
    type: "MONEY",
    required: true,
    accountType: "INDIVIDUAL",
    moduleCode: "RRSP",
    showIf: "has_rrsp_contribution",
  },
  {
    code: "has_union_dues",
    section: "deductions",
    textFr: "Avez-vous payé des cotisations syndicales ou professionnelles en 2025 ?",
    textEn: "Did you pay union or professional dues in 2025?",
    hintFr: "Cotisations à un syndicat, ordre professionnel ou association",
    hintEn: "Union, professional order or association dues",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    moduleCode: "EMPLOYMENT",
    showIf: "has_employment_income",
  },
  {
    code: "has_student_loan_interest",
    section: "deductions",
    textFr: "Avez-vous payé des intérêts sur un prêt étudiant en 2025 ?",
    textEn: "Did you pay interest on a student loan in 2025?",
    hintFr: "Prêt du gouvernement fédéral ou provincial uniquement",
    hintEn: "Federal or provincial government loan only",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
  },
  {
    code: "has_moving_expenses",
    section: "deductions",
    textFr: "Avez-vous déménagé pour un nouvel emploi, une entreprise ou des études en 2025 ?",
    textEn: "Did you move for a new job, business or studies in 2025?",
    hintFr: "Déménagement d'au moins 40 km plus près du lieu de travail ou d'études",
    hintEn: "Move of at least 40 km closer to your work or school",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
  },

  // ── FAMILLE ─────────────────────────────────────────────────────────────────
  {
    code: "has_dependents",
    section: "family",
    textFr: "Avez-vous des personnes à charge (enfants, parents, etc.) ?",
    textEn: "Do you have dependants (children, parents, etc.)?",
    hintFr: "Cela peut ouvrir droit à plusieurs crédits d'impôt importants",
    hintEn: "This may entitle you to several important tax credits",
    type: "BOOLEAN",
    required: true,
    accountType: "INDIVIDUAL",
    activatesModule: "FAMILY",
  },
  {
    code: "has_childcare_expenses",
    section: "family",
    textFr: "Avez-vous payé des frais de garde d'enfants en 2025 ?",
    textEn: "Did you pay childcare expenses in 2025?",
    hintFr: "Garderie, camp de jour, garde à domicile, service de garde en milieu scolaire",
    hintEn: "Daycare, day camp, home care, school-based childcare",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    moduleCode: "FAMILY",
    showIf: "has_dependents",
    documentRequired: "CHILDCARE_RECEIPT",
  },
  {
    code: "has_medical_expenses",
    section: "family",
    textFr: "Avez-vous eu des dépenses médicales importantes en 2025 ?",
    textEn: "Did you have significant medical expenses in 2025?",
    hintFr: "Médicaments, dentiste, lunettes, prothèses, psychologie, etc.",
    hintEn: "Medications, dentist, glasses, prosthetics, psychology, etc.",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
  },
  {
    code: "has_disability_amount",
    section: "family",
    textFr: "Vous ou une personne à votre charge avez-vous un certificat T2201 (handicap) ?",
    textEn: "Do you or a dependent have a T2201 disability certificate?",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    documentRequired: "T2201",
  },

  // ── REVENUS DIVERS ──────────────────────────────────────────────────────────
  {
    code: "has_ei_benefits",
    section: "employment",
    textFr: "Avez-vous reçu des prestations d'assurance-emploi (AE) en 2025 ?",
    textEn: "Did you receive Employment Insurance (EI) benefits in 2025?",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    documentRequired: "T4E",
  },
  {
    code: "has_pension_income",
    section: "employment",
    textFr: "Avez-vous reçu une pension de retraite ou un revenu de RPC/RRQ en 2025 ?",
    textEn: "Did you receive pension or CPP/QPP income in 2025?",
    hintFr: "Régime de retraite, RPC, RRQ, pension de vieillesse",
    hintEn: "Pension plan, CPP, QPP, old age security",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    activatesModule: "PENSION",
    documentRequired: "T4A",
  },
  {
    code: "has_foreign_income",
    section: "investment",
    textFr: "Avez-vous eu des revenus provenant de l'extérieur du Canada en 2025 ?",
    textEn: "Did you have income from outside Canada in 2025?",
    hintFr: "Salaires étrangers, dividendes étrangers, pensions étrangères",
    hintEn: "Foreign wages, dividends, pensions",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    activatesModule: "FOREIGN_INCOME",
    documentRequired: "FOREIGN_INCOME_SLIP",
  },
  {
    code: "changed_province",
    section: "identity",
    textFr: "Avez-vous changé de province de résidence en 2025 ?",
    textEn: "Did you change your province of residence in 2025?",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
  },

  // ── CRÉDITS ─────────────────────────────────────────────────────────────────
  {
    code: "has_donations",
    section: "credits",
    textFr: "Avez-vous fait des dons à des organismes de bienfaisance en 2025 ?",
    textEn: "Did you make donations to charitable organizations in 2025?",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    documentRequired: "DONATION_RECEIPT",
  },
  {
    code: "has_tuition",
    section: "credits",
    textFr: "Avez-vous payé des frais de scolarité en 2025 ?",
    textEn: "Did you pay tuition fees in 2025?",
    hintFr: "Université, cégep, collège ou formation professionnelle admissible",
    hintEn: "University, CEGEP, college or eligible vocational training",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    documentRequired: "T2202",
  },
  {
    code: "first_time_home_buyer",
    section: "credits",
    textFr: "Avez-vous acheté votre première maison en 2025 ?",
    textEn: "Did you buy your first home in 2025?",
    hintFr: "Crédit d'impôt pour l'achat d'une première habitation (CIAPH)",
    hintEn: "First Home Buyers' Tax Credit (FHBTC)",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
  },

  // ── QUÉBEC SPÉCIFIQUE ────────────────────────────────────────────────────────
  {
    code: "has_solidarity_credit",
    section: "provincial",
    textFr: "Souhaitez-vous demander le crédit d'impôt pour solidarité (Québec) ?",
    textEn: "Would you like to claim the solidarity tax credit (Quebec)?",
    hintFr: "Basé sur votre situation de logement et revenu familial",
    hintEn: "Based on your housing situation and family income",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
  },
  {
    code: "rent_paid_2025",
    section: "provincial",
    textFr: "Avez-vous payé un loyer en 2025 au Québec ?",
    textEn: "Did you pay rent in 2025 in Quebec?",
    hintFr: "Nécessaire pour le crédit de solidarité — composante logement",
    hintEn: "Required for the solidarity credit — housing component",
    type: "BOOLEAN",
    required: false,
    accountType: "INDIVIDUAL",
    showIf: "has_solidarity_credit",
  },
];

// ─── MOTEUR ────────────────────────────────────────────────────────────────────

/**
 * Retourne les questions applicables selon :
 * - le rôle du compte (INDIVIDUAL / BUSINESS)
 * - les modules actifs
 * - les réponses déjà données
 */
export function getApplicableQuestions(
  accountType: "INDIVIDUAL" | "BUSINESS",
  activeModules: ModuleCode[],
  answers: Record<string, string | boolean | null>
): QuestionDef[] {
  return QUESTION_DEFINITIONS.filter((q) => {
    // 1. Filtrer par type de compte
    if (q.accountType !== "ALL" && q.accountType !== accountType) return false;

    // 2. Si la question nécessite un module actif
    if (q.moduleCode && !activeModules.includes(q.moduleCode)) return false;

    // 3. Condition showIf
    if (q.showIf) {
      const parentAnswer = answers[q.showIf];
      const expectedValue = q.showIfValue ?? "true";
      const actualValue = String(parentAnswer ?? "");
      if (actualValue !== expectedValue && parentAnswer !== true) return false;
    }

    return true;
  });
}

/**
 * Détermine quels modules activer selon les réponses
 */
export function getModulesToActivate(
  answers: Record<string, string | boolean | null>
): ModuleCode[] {
  const modules: ModuleCode[] = [];

  const check = (code: string) =>
    answers[code] === true || answers[code] === "true";

  if (check("has_employment_income"))  modules.push("EMPLOYMENT");
  if (check("has_self_employment"))    modules.push("SELF_EMPLOYED");
  if (check("has_rental_income"))      modules.push("RENTAL");
  if (check("has_investment_income"))  modules.push("INVESTMENT");
  if (check("has_crypto"))             modules.push("CRYPTO");
  if (check("has_foreign_income"))     modules.push("FOREIGN_INCOME");
  if (check("has_dependents"))         modules.push("FAMILY");
  if (check("has_pension_income"))     modules.push("PENSION");
  if (check("has_rrsp_contribution"))  modules.push("RRSP");
  if (check("worked_from_home"))       modules.push("HOME_OFFICE");
  if (check("self_employment_vehicle")) modules.push("VEHICLE");

  const numEmployers = Number(answers["num_employers"] ?? 1);
  if (numEmployers > 1) modules.push("EMPLOYMENT_MULTIPLE");

  // Détection plateformes autonomes
  const selfType = answers["self_employment_type"] as string ?? "";
  if (selfType.includes("uber") || selfType.includes("UBER"))  modules.push("SELF_EMPLOYED_UBER");
  if (selfType.includes("lyft") || selfType.includes("LYFT"))  modules.push("SELF_EMPLOYED_LYFT");

  return [...new Set(modules)]; // dédupliquer
}

/**
 * Calcule la progression dynamique du dossier
 */
export function calculateProgress(
  applicableQuestions: QuestionDef[],
  answers: Record<string, string | boolean | null>,
  documentsCount: number,
  documentsRequired: number,
  validatedDocs: number
): {
  globalPct: number;
  bySection: Record<string, number>;
  questionsAnswered: number;
  questionsApplicable: number;
  isReadyForCalc: boolean;
  blockingItems: string[];
} {
  const sections: Record<string, { total: number; answered: number }> = {};

  for (const q of applicableQuestions) {
    const s = q.section;
    if (!sections[s]) sections[s] = { total: 0, answered: 0 };
    sections[s].total++;
    if (answers[q.code] !== undefined && answers[q.code] !== null) {
      sections[s].answered++;
    }
  }

  const questionsAnswered = Object.values(sections).reduce((a, s) => a + s.answered, 0);
  const questionsApplicable = applicableQuestions.length;

  const bySection: Record<string, number> = {};
  for (const [s, { total, answered }] of Object.entries(sections)) {
    bySection[s] = total > 0 ? Math.round((answered / total) * 100) : 100;
  }

  // Progression globale : 60% questions + 30% documents + 10% validation
  const qPct  = questionsApplicable > 0 ? (questionsAnswered / questionsApplicable) : 0;
  const dPct  = documentsRequired   > 0 ? (documentsCount   / documentsRequired)   : 1;
  const vPct  = documentsRequired   > 0 ? (validatedDocs    / documentsRequired)   : 1;
  const globalPct = Math.round((qPct * 60 + dPct * 30 + vPct * 10));

  // Éléments bloquants
  const blockingItems: string[] = [];
  const required = applicableQuestions.filter((q) => q.required);
  for (const q of required) {
    if (answers[q.code] === undefined || answers[q.code] === null) {
      blockingItems.push(`question:${q.code}`);
    }
  }
  if (documentsRequired > 0 && validatedDocs < documentsRequired) {
    blockingItems.push(`documents:${validatedDocs}/${documentsRequired} validés`);
  }

  const isReadyForCalc = blockingItems.length === 0 && globalPct >= 80;

  return {
    globalPct,
    bySection,
    questionsAnswered,
    questionsApplicable,
    isReadyForCalc,
    blockingItems,
  };
}

/**
 * Retourne les documents requis selon les modules actifs
 */
export function getRequiredDocuments(
  activeModules: ModuleCode[],
  answers: Record<string, string | boolean | null>
): { code: string; labelFr: string; labelEn: string; required: boolean }[] {
  const docs: { code: string; labelFr: string; labelEn: string; required: boolean }[] = [];

  if (activeModules.includes("EMPLOYMENT")) {
    const n = Number(answers["num_employers"] ?? 1);
    for (let i = 1; i <= Math.min(n, 5); i++) {
      docs.push({ code: "T4", labelFr: `Feuillet T4 — Employeur ${i}`, labelEn: `T4 slip — Employer ${i}`, required: true });
      docs.push({ code: "RL1", labelFr: `Relevé 1 — Employeur ${i}`, labelEn: `RL-1 — Employer ${i}`, required: true });
    }
  }
  if (activeModules.includes("INVESTMENT"))
    docs.push({ code: "T5", labelFr: "Feuillet T5 (revenus de placement)", labelEn: "T5 slip (investment income)", required: true });
  if (activeModules.includes("PENSION"))
    docs.push({ code: "T4A", labelFr: "Feuillet T4A (pension)", labelEn: "T4A slip (pension)", required: true });
  if (activeModules.includes("RRSP"))
    docs.push({ code: "RRSP_RECEIPT", labelFr: "Reçu de cotisation REER", labelEn: "RRSP contribution receipt", required: true });
  if (activeModules.includes("SELF_EMPLOYED") || activeModules.includes("SELF_EMPLOYED_UBER"))
    docs.push({ code: "SELF_EMP_REVENUE", labelFr: "Relevé annuel de revenus autonomes", labelEn: "Annual self-employment revenue statement", required: false });
  if (answers["has_donations"] === true)
    docs.push({ code: "DONATION_RECEIPT", labelFr: "Reçu de dons de bienfaisance", labelEn: "Charitable donation receipt", required: false });
  if (answers["has_tuition"] === true)
    docs.push({ code: "T2202", labelFr: "Relevé T2202 (frais de scolarité)", labelEn: "T2202 (tuition fees)", required: true });
  if (answers["has_childcare_expenses"] === true)
    docs.push({ code: "CHILDCARE_RECEIPT", labelFr: "Reçus de frais de garde", labelEn: "Childcare expense receipts", required: true });

  return docs;
}

export const MODULE_LABELS: Record<string, { fr: string; en: string; icon: string }> = {
  EMPLOYMENT:          { fr: "Emploi",              en: "Employment",        icon: "💼" },
  EMPLOYMENT_MULTIPLE: { fr: "Plusieurs employeurs", en: "Multiple employers", icon: "💼" },
  SELF_EMPLOYED:       { fr: "Travail autonome",     en: "Self-employment",   icon: "🧑‍💼" },
  SELF_EMPLOYED_UBER:  { fr: "Uber / livraison",     en: "Uber / delivery",   icon: "🚗" },
  SELF_EMPLOYED_LYFT:  { fr: "Lyft",                en: "Lyft",              icon: "🚗" },
  RENTAL:              { fr: "Location",             en: "Rental",            icon: "🏠" },
  INVESTMENT:          { fr: "Placements",           en: "Investments",       icon: "📈" },
  CRYPTO:              { fr: "Cryptomonnaies",       en: "Cryptocurrency",    icon: "₿"  },
  FOREIGN_INCOME:      { fr: "Revenus étrangers",    en: "Foreign income",    icon: "🌍" },
  FAMILY:              { fr: "Famille",              en: "Family",            icon: "👨‍👩‍👧" },
  PENSION:             { fr: "Pension",              en: "Pension",           icon: "🧓" },
  RRSP:                { fr: "REER",                en: "RRSP",              icon: "💰" },
  HOME_OFFICE:         { fr: "Bureau à domicile",   en: "Home office",       icon: "🏡" },
  VEHICLE:             { fr: "Véhicule",             en: "Vehicle",           icon: "🚙" },
};
