/**
 * dictionnaire.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Source: Dictionnaire_de_segmentation_OCR_2025.json (v2025.1.0)
 * Généré depuis declaration-pancanadienne-2025.html + extracteurs EasyTax
 *
 * USAGE:
 *   1. Classifier le document (anchors)
 *   2. Charger getSlipDict(slipCode)
 *   3. Pour chaque box: chercher keywords dans le texte OCR
 *   4. Extraire le montant avec MONEY_PATTERN
 *   5. Mapper vers t1_line / tp1_line
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export interface BoxDef {
  code: string;
  label_fr: string;
  label_en?: string;
  t1_line: string | null;
  tp1_line: string | null;
  data_type: "money" | "text" | "number" | "date";
  keywords_fr: string[];
  keywords_en: string[];
  notes?: string;
  auto_deduction_line?: string | null;
}

export interface SlipDef {
  code: string;
  name_fr: string;
  name_en: string;
  authority: "federal" | "provincial";
  anchors: string[];
  boxes: BoxDef[];
}

export interface T1Line {
  label_fr: string;
  label_en?: string;
  section: "revenus" | "deductions" | "credits" | "total" | "withheld" | "other";
}

export interface TP1Line {
  label_fr: string;
  section: string;
}

export interface ProvinceDef {
  code: string;
  name_fr: string;
  form: string;
  bpa_2025: number;
  brackets: Array<{ up_to: number; rate: number }>;
  top_rate: number;
  notes: string;
}

// ── FEUILLETS — 14 types, 39 cases ──────────────────────────────────────────
export const SLIP_DICT: SlipDef[] = [
  {
    code: "T4", name_fr: "État de la rémunération payée", name_en: "Statement of Remuneration Paid",
    authority: "federal",
    anchors: ["T4", "Statement of Remuneration Paid", "État de la rémunération payée"],
    boxes: [
      { code: "14", label_fr: "Revenus d'emploi", label_en: "Employment income",
        t1_line: "10100", tp1_line: null, data_type: "money",
        keywords_fr: ["revenus d'emploi", "emploi"], keywords_en: ["employment income"],
        notes: "Case principale du T4" },
      { code: "16", label_fr: "Cotisations de l'employé au RPC/RRQ", label_en: "Employee's CPP/QPP contributions",
        t1_line: "30800", tp1_line: null, data_type: "money",
        keywords_fr: ["cotisations", "rpc", "rrq"], keywords_en: ["CPP", "QPP", "contributions"] },
      { code: "18", label_fr: "Cotisations de l'employé à l'AE", label_en: "Employee's EI premiums",
        t1_line: "31200", tp1_line: null, data_type: "money",
        keywords_fr: ["assurance-emploi", "ae", "cotisations ae"], keywords_en: ["EI", "premiums"] },
      { code: "22", label_fr: "Impôt sur le revenu retenu", label_en: "Income tax deducted",
        t1_line: "43700", tp1_line: null, data_type: "money",
        keywords_fr: ["impôt retenu", "retenu"], keywords_en: ["income tax deducted"] },
      { code: "24", label_fr: "Gains assurables aux fins de l'AE", label_en: "EI insurable earnings",
        t1_line: null, tp1_line: null, data_type: "money",
        keywords_fr: ["gains assurables"], keywords_en: ["EI insurable"] },
      { code: "26", label_fr: "Gains ouvrant droit à pension au RPC/RRQ", label_en: "CPP/QPP pensionable earnings",
        t1_line: null, tp1_line: null, data_type: "money",
        keywords_fr: ["gains", "pension rpc"], keywords_en: ["pensionable earnings"] },
      { code: "40", label_fr: "Autres revenus d'emploi (avantages imposables)", label_en: "Other employment income",
        t1_line: "10400", tp1_line: null, data_type: "money",
        keywords_fr: ["avantages imposables", "autres revenus emploi"], keywords_en: ["taxable benefits"] },
      { code: "44", label_fr: "Cotisations syndicales", label_en: "Union dues",
        t1_line: "21200", tp1_line: null, data_type: "money",
        keywords_fr: ["syndicales", "cotisations syndicales"], keywords_en: ["union dues"] },
      { code: "46", label_fr: "Dons de bienfaisance", label_en: "Charitable donations",
        t1_line: "34900", tp1_line: null, data_type: "money",
        keywords_fr: ["dons"], keywords_en: ["charitable donations"] },
    ],
  },
  {
    code: "T4A", name_fr: "État du revenu de pension, de retraite, de rente et d'autres sources",
    name_en: "Statement of Pension, Retirement, Annuity, and Other Income",
    authority: "federal",
    anchors: ["T4A", "pension", "retraite", "rente"],
    boxes: [
      { code: "016", label_fr: "Pension ou rente de retraite", label_en: "Pension or superannuation",
        t1_line: "11500", tp1_line: null, data_type: "money",
        keywords_fr: ["pension", "retraite"], keywords_en: ["pension", "superannuation"] },
      { code: "018", label_fr: "Paiement forfaitaire rétroactif", label_en: "Lump-sum payment",
        t1_line: "13000", tp1_line: null, data_type: "money",
        keywords_fr: ["forfaitaire", "montant forfaitaire"], keywords_en: ["lump-sum"] },
      { code: "020", label_fr: "Commissions", label_en: "Self-employment commissions",
        t1_line: "13900", tp1_line: null, data_type: "money",
        keywords_fr: ["commissions"], keywords_en: ["commissions"] },
      { code: "022", label_fr: "Impôt retenu (T4A)", label_en: "Income tax deducted (T4A)",
        t1_line: "43700", tp1_line: "451", data_type: "money",
        keywords_fr: ["impôt retenu"], keywords_en: ["income tax deducted"] },
      { code: "024", label_fr: "Rentes", label_en: "Annuities",
        t1_line: "13000", tp1_line: null, data_type: "money",
        keywords_fr: ["rentes", "rente"], keywords_en: ["annuities"] },
      { code: "048", label_fr: "Honoraires ou autres sommes pour services", label_en: "Fees for services",
        t1_line: "13500", tp1_line: "164", data_type: "money",
        keywords_fr: ["honoraires", "services"], keywords_en: ["fees", "services"],
        notes: "→ revenu d'entreprise T2125 sauf indication contraire" },
      { code: "105", label_fr: "Bourses d'études (partie imposable)", label_en: "Scholarships (taxable)",
        t1_line: "13010", tp1_line: "154", data_type: "money",
        keywords_fr: ["bourses", "études", "fellowships"], keywords_en: ["scholarships", "fellowships"] },
    ],
  },
  {
    code: "T4A(OAS)", name_fr: "État de la pension de la Sécurité de la vieillesse",
    name_en: "Statement of Old Age Security",
    authority: "federal",
    anchors: ["T4A(OAS)", "OAS", "Sécurité de la vieillesse", "Old Age Security"],
    boxes: [
      { code: "18", label_fr: "Pension de la Sécurité de la vieillesse", label_en: "Old Age Security pension",
        t1_line: "11300", tp1_line: "114", data_type: "money",
        keywords_fr: ["sécurité de la vieillesse", "vieillesse", "sv"], keywords_en: ["old age security", "OAS"] },
    ],
  },
  {
    code: "T4A(P)", name_fr: "État des prestations du RPC/RRQ",
    name_en: "Statement of Canada Pension Plan Benefits",
    authority: "federal",
    anchors: ["T4A(P)", "RPC", "RRQ", "Canada Pension Plan"],
    boxes: [
      { code: "20", label_fr: "Prestations de retraite du RPC/RRQ", label_en: "CPP/QPP retirement benefits",
        t1_line: "11400", tp1_line: "111", data_type: "money",
        keywords_fr: ["rpc", "rrq", "prestations retraite"], keywords_en: ["CPP", "QPP", "retirement"] },
    ],
  },
  {
    code: "T4E", name_fr: "État des prestations d'assurance-emploi",
    name_en: "Statement of Employment Insurance Benefits",
    authority: "federal",
    anchors: ["T4E", "assurance-emploi", "Employment Insurance", "EI"],
    boxes: [
      { code: "14", label_fr: "Prestations d'assurance-emploi", label_en: "Employment insurance benefits",
        t1_line: "11900", tp1_line: "154", data_type: "money",
        keywords_fr: ["assurance-emploi", "prestations ae"], keywords_en: ["employment insurance", "EI benefits"] },
      { code: "22", label_fr: "Impôt retenu (T4E)", label_en: "Income tax deducted (T4E)",
        t1_line: "43700", tp1_line: "451", data_type: "money",
        keywords_fr: ["impôt retenu"], keywords_en: ["income tax deducted"] },
    ],
  },
  {
    code: "T5", name_fr: "État des revenus de placements",
    name_en: "Statement of Investment Income",
    authority: "federal",
    anchors: ["T5", "revenus de placements", "investment income"],
    boxes: [
      { code: "13", label_fr: "Intérêts de source canadienne", label_en: "Interest from Canadian sources",
        t1_line: "12100", tp1_line: "128", data_type: "money",
        keywords_fr: ["intérêts"], keywords_en: ["interest"] },
      { code: "24", label_fr: "Montant imposable des dividendes déterminés", label_en: "Taxable amount of eligible dividends",
        t1_line: "12100", tp1_line: "128", data_type: "money",
        keywords_fr: ["dividendes", "déterminés"], keywords_en: ["eligible dividends"] },
      { code: "25", label_fr: "Crédit d'impôt pour dividendes", label_en: "Dividend tax credit",
        t1_line: null, tp1_line: null, data_type: "money",
        keywords_fr: ["crédit d'impôt", "dividendes"], keywords_en: ["dividend tax credit"] },
    ],
  },
  {
    code: "T3", name_fr: "État des revenus de fiducie applicables aux bénéficiaires",
    name_en: "Statement of Trust Income Allocations and Designations",
    authority: "federal",
    anchors: ["T3", "fiducie", "trust income"],
    boxes: [
      { code: "INT", label_fr: "Intérêts de fiducie / placements", label_en: "Trust interest / investment income",
        t1_line: "12100", tp1_line: "128", data_type: "money",
        keywords_fr: ["fiducie", "intérêts"], keywords_en: ["trust", "interest"] },
    ],
  },
  {
    code: "T5007", name_fr: "État des prestations (accidents du travail / assistance sociale)",
    name_en: "Statement of Benefits",
    authority: "federal",
    anchors: ["T5007", "accidents du travail", "workers compensation", "social assistance"],
    boxes: [
      { code: "10", label_fr: "Indemnités reçues (CNESST / assistance sociale)",
        label_en: "Workers compensation / social assistance",
        t1_line: "14400", tp1_line: "148", data_type: "money",
        keywords_fr: ["indemnités", "accidents du travail", "assistance sociale", "cnesst"],
        keywords_en: ["workers compensation", "social assistance"],
        notes: "⚠️ Inclusion ligne 14400 + déduction automatique ligne 25000",
        auto_deduction_line: "25000" },
    ],
  },
  // ── RELEVÉS QUÉBEC ────────────────────────────────────────────────────────
  {
    code: "RL-1", name_fr: "Relevé 1 — Revenus d'emploi et revenus divers",
    name_en: "RL-1 — Employment and Other Income",
    authority: "provincial",
    anchors: ["RL-1", "Relevé 1", "revenus d'emploi", "Revenu Québec"],
    boxes: [
      { code: "A", label_fr: "Revenus d'emploi", label_en: "Employment income",
        t1_line: "10100", tp1_line: "101", data_type: "money",
        keywords_fr: ["salaires", "traitements", "emploi"], keywords_en: ["salary", "employment"] },
      { code: "B", label_fr: "Cotisations au RRQ", label_en: "QPP contributions",
        t1_line: "30800", tp1_line: "206", data_type: "money",
        keywords_fr: ["rrq", "cotisation rrq"], keywords_en: ["QPP", "contributions"] },
      { code: "E", label_fr: "Impôt du Québec retenu", label_en: "Quebec income tax withheld",
        t1_line: null, tp1_line: "451", data_type: "money",
        keywords_fr: ["impôt retenu", "québec", "retenu"], keywords_en: ["Quebec income tax", "withheld"] },
      { code: "G", label_fr: "Salaire admissible au RRQ", label_en: "QPP admissible salary",
        t1_line: null, tp1_line: null, data_type: "money",
        keywords_fr: ["salaire admissible", "rrq"], keywords_en: ["admissible salary", "QPP"] },
    ],
  },
  {
    code: "RL-2", name_fr: "Relevé 2 — Revenus de retraite et rentes",
    name_en: "RL-2 — Retirement and Annuity Income",
    authority: "provincial",
    anchors: ["RL-2", "Relevé 2", "retraite", "rentes"],
    boxes: [
      { code: "A", label_fr: "Revenus de retraite et rentes", label_en: "Retirement and annuity income",
        t1_line: "11500", tp1_line: "111", data_type: "money",
        keywords_fr: ["retraite", "prestations rentes"], keywords_en: ["retirement", "annuity"] },
      { code: "C", label_fr: "Impôt du Québec retenu (RL-2)", label_en: "Quebec tax withheld (RL-2)",
        t1_line: null, tp1_line: "451", data_type: "money",
        keywords_fr: ["impôt retenu"], keywords_en: ["income tax withheld"] },
    ],
  },
  {
    code: "RL-3", name_fr: "Relevé 3 — Revenus de placements",
    name_en: "RL-3 — Investment Income",
    authority: "provincial",
    anchors: ["RL-3", "Relevé 3", "revenus de placements"],
    boxes: [
      { code: "BCD", label_fr: "Intérêts et dividendes (RL-3)", label_en: "Interest and dividends (RL-3)",
        t1_line: "12100", tp1_line: "128", data_type: "money",
        keywords_fr: ["placements", "intérêts", "dividendes"], keywords_en: ["investment", "interest", "dividends"] },
    ],
  },
  {
    code: "RL-5", name_fr: "Relevé 5 — Prestations et indemnités",
    name_en: "RL-5 — Benefits and Indemnities",
    authority: "provincial",
    anchors: ["RL-5", "Relevé 5", "CNESST", "prestations"],
    boxes: [
      { code: "C", label_fr: "Indemnités de remplacement du revenu (CNESST)",
        label_en: "Income replacement benefits (CNESST)",
        t1_line: "14400", tp1_line: "148", data_type: "money",
        keywords_fr: ["indemnités reçues", "cnesst", "remplacement revenu"],
        keywords_en: ["income replacement", "CNESST"],
        notes: "⚠️ Inclusion TP-1 ligne 148 + déduction automatique ligne 295",
        auto_deduction_line: "295" },
      { code: "E", label_fr: "Allocation pour civisme", label_en: "Civic allowance",
        t1_line: null, tp1_line: null, data_type: "money",
        keywords_fr: ["civisme"], keywords_en: ["civic"] },
      { code: "M", label_fr: "Redressement", label_en: "Adjustment",
        t1_line: null, tp1_line: null, data_type: "money",
        keywords_fr: ["redressement"], keywords_en: ["adjustment"] },
      { code: "O", label_fr: "Redressement années passées", label_en: "Prior years adjustment",
        t1_line: null, tp1_line: null, data_type: "money",
        keywords_fr: ["années passées", "redressement"], keywords_en: ["prior years"] },
      { code: "P", label_fr: "Remboursement", label_en: "Reimbursement",
        t1_line: null, tp1_line: null, data_type: "money",
        keywords_fr: ["remboursement"], keywords_en: ["reimbursement"] },
    ],
  },
  {
    code: "RL-16", name_fr: "Relevé 16 — Gains en capital", name_en: "RL-16 — Capital Gains",
    authority: "provincial",
    anchors: ["RL-16", "Relevé 16", "gains en capital", "capital gains"],
    boxes: [
      { code: "CG", label_fr: "Gains en capital (RL-16)", label_en: "Capital gains (RL-16)",
        t1_line: "12700", tp1_line: null, data_type: "money",
        keywords_fr: ["gains en capital"], keywords_en: ["capital gains"] },
    ],
  },
  {
    code: "RL-31", name_fr: "Relevé 31 — Renseignements sur l'occupation d'un logement",
    name_en: "RL-31 — Housing Occupancy",
    authority: "provincial",
    anchors: ["RL-31", "Relevé 31", "logement", "housing"],
    boxes: [
      { code: "NUM", label_fr: "Numéro de logement / montant du loyer", label_en: "Housing / rent amount",
        t1_line: null, tp1_line: null, data_type: "money",
        keywords_fr: ["relevé 31", "logement", "loyer"], keywords_en: ["housing", "rent"] },
    ],
  },
];

// ── LIGNES T1 (48 lignes) ────────────────────────────────────────────────────
export const T1_DICT: Record<string, T1Line> = {
  "10100": { label_fr: "Revenus d'emploi (T4-14)", label_en: "Employment income (T4-14)", section: "revenus" },
  "10400": { label_fr: "Autres revenus d'emploi", label_en: "Other employment income", section: "revenus" },
  "11300": { label_fr: "Pension de la Sécurité de la vieillesse", label_en: "Old Age Security pension", section: "revenus" },
  "11400": { label_fr: "Prestations du RPC/RRQ", label_en: "CPP/QPP benefits", section: "revenus" },
  "11500": { label_fr: "Pensions et rentes (T4A-016)", label_en: "Pensions and annuities", section: "revenus" },
  "11900": { label_fr: "Prestations d'assurance-emploi", label_en: "EI benefits", section: "revenus" },
  "12100": { label_fr: "Intérêts et revenus de placements", label_en: "Interest and investment income", section: "revenus" },
  "12600": { label_fr: "Revenus de location nets", label_en: "Net rental income", section: "revenus" },
  "12700": { label_fr: "Gains en capital imposables", label_en: "Taxable capital gains", section: "revenus" },
  "12900": { label_fr: "Retraits REER", label_en: "RRSP income", section: "revenus" },
  "13000": { label_fr: "Autres revenus", label_en: "Other income", section: "revenus" },
  "13010": { label_fr: "Bourses (partie imposable)", label_en: "Scholarships (taxable portion)", section: "revenus" },
  "13500": { label_fr: "Revenus d'entreprise nets", label_en: "Net business income", section: "revenus" },
  "13900": { label_fr: "Revenus de profession libérale nets", label_en: "Net professional income", section: "revenus" },
  "14400": { label_fr: "Indemnités de travailleur (T5007)", label_en: "Workers comp / social assistance", section: "revenus" },
  "14600": { label_fr: "Supplément de revenu garanti (SRG)", label_en: "Guaranteed Income Supplement", section: "revenus" },
  "15000": { label_fr: "Revenu total", label_en: "Total income", section: "total" },
  "20600": { label_fr: "Cotisations RPC/RRQ — travail autonome", label_en: "CPP/QPP — self-employment", section: "deductions" },
  "20800": { label_fr: "Déduction pour REER / CELIAPP", label_en: "RRSP / FHSA deduction", section: "deductions" },
  "21200": { label_fr: "Cotisations syndicales / professionnelles", label_en: "Union / professional dues", section: "deductions" },
  "21400": { label_fr: "Frais de garde d'enfants", label_en: "Child care expenses", section: "deductions" },
  "21900": { label_fr: "Frais de déménagement", label_en: "Moving expenses", section: "deductions" },
  "22900": { label_fr: "Dépenses d'emploi (T2200)", label_en: "Employment expenses (T2200)", section: "deductions" },
  "23200": { label_fr: "Autres déductions", label_en: "Other deductions", section: "deductions" },
  "25000": { label_fr: "Déduction T5007 (indemnités)", label_en: "T5007 deduction (workers comp)", section: "deductions" },
  "23600": { label_fr: "Revenu net", label_en: "Net income", section: "total" },
  "26000": { label_fr: "Revenu imposable", label_en: "Taxable income", section: "total" },
  "30000": { label_fr: "Montant personnel de base (16 129 $)", label_en: "Basic personal amount", section: "credits" },
  "30800": { label_fr: "Cotisations RPC/RRQ employé (T4-16)", label_en: "Employee CPP/QPP (T4-16)", section: "credits" },
  "31200": { label_fr: "Cotisations à l'AE (T4-18)", label_en: "EI premiums (T4-18)", section: "credits" },
  "31260": { label_fr: "Montant canadien pour emploi", label_en: "Canada employment amount", section: "credits" },
  "32300": { label_fr: "Frais de scolarité (T2202)", label_en: "Tuition (T2202)", section: "credits" },
  "33099": { label_fr: "Frais médicaux", label_en: "Medical expenses", section: "credits" },
  "34900": { label_fr: "Dons de bienfaisance (T4-46)", label_en: "Charitable donations", section: "credits" },
  "43700": { label_fr: "Total de l'impôt retenu (T4-22)", label_en: "Total income tax deducted", section: "withheld" },
  "47600": { label_fr: "Acomptes provisionnels", label_en: "Tax instalments paid", section: "withheld" },
};

// ── LIGNES TP-1 (25 lignes) ──────────────────────────────────────────────────
export const TP1_DICT: Record<string, TP1Line> = {
  "101":  { label_fr: "Revenus d'emploi (RL-1 case A)", section: "revenus" },
  "111":  { label_fr: "Pensions et rentes (RL-2 case A)", section: "revenus" },
  "114":  { label_fr: "Prestations gouvernementales (RPC/RRQ/SV)", section: "revenus" },
  "128":  { label_fr: "Dividendes et intérêts (RL-3)", section: "revenus" },
  "148":  { label_fr: "Indemnités (RL-5 case C)", section: "revenus" },
  "154":  { label_fr: "Autres revenus", section: "revenus" },
  "164":  { label_fr: "Revenus d'entreprise nets (annexe L)", section: "revenus" },
  "199":  { label_fr: "Revenu total", section: "total" },
  "206":  { label_fr: "Cotisations RRQ emploi (RL-1 case B)", section: "deductions" },
  "207":  { label_fr: "Autres déductions", section: "deductions" },
  "208":  { label_fr: "Cotisations REER", section: "deductions" },
  "210":  { label_fr: "Cotisations syndicales (RL-1 case D)", section: "deductions" },
  "214":  { label_fr: "Frais de garde", section: "deductions" },
  "225":  { label_fr: "Pension alimentaire payée", section: "deductions" },
  "248":  { label_fr: "Revenu net", section: "total" },
  "295":  { label_fr: "Déduction RL-5 case C (CNESST)", section: "deductions" },
  "299":  { label_fr: "Revenu imposable", section: "total" },
  "350":  { label_fr: "Montant personnel de base (18 571 $)", section: "credits" },
  "375":  { label_fr: "Cotisations RQAP", section: "credits" },
  "381":  { label_fr: "Frais médicaux", section: "credits" },
  "395":  { label_fr: "Dons de bienfaisance", section: "credits" },
  "398":  { label_fr: "Frais de scolarité (RL-8)", section: "credits" },
  "430":  { label_fr: "Cotisation RRQ — travail autonome", section: "other" },
  "451":  { label_fr: "Impôt du Québec retenu (RL-1 case E)", section: "withheld" },
  "460":  { label_fr: "Acomptes provisionnels", section: "withheld" },
};

// ── PROVINCES (13) ───────────────────────────────────────────────────────────
export const PROVINCE_DICT: ProvinceDef[] = [
  { code: "QC", name_fr: "Québec", form: "TP-1", bpa_2025: 18571,
    brackets: [{up_to:53255,rate:.14},{up_to:106495,rate:.19},{up_to:129590,rate:.24}],
    top_rate: .2575, notes: "Abattement fédéral 16,5%. RRQ+RQAP." },
  { code: "ON", name_fr: "Ontario", form: "ON428", bpa_2025: 11865,
    brackets: [{up_to:51446,rate:.0505},{up_to:102894,rate:.0915},{up_to:150000,rate:.1116},{up_to:220000,rate:.1216}],
    top_rate: .1316, notes: "Surtaxe ON: 5 710$/7 307$. Prime santé 0-900$." },
  { code: "AB", name_fr: "Alberta", form: "AT1", bpa_2025: 22323,
    brackets: [{up_to:148269,rate:.10},{up_to:177922,rate:.12},{up_to:237230,rate:.13},{up_to:355845,rate:.14}],
    top_rate: .15, notes: "Pas de taxe de vente provinciale." },
  { code: "BC", name_fr: "Colombie-Britannique", form: "BC428", bpa_2025: 11981,
    brackets: [{up_to:45654,rate:.0506},{up_to:91310,rate:.077},{up_to:104835,rate:.105},{up_to:127299,rate:.1229},{up_to:172602,rate:.147},{up_to:240716,rate:.168}],
    top_rate: .205, notes: "" },
  { code: "SK", name_fr: "Saskatchewan", form: "SK428", bpa_2025: 17661,
    brackets: [{up_to:49720,rate:.105},{up_to:142058,rate:.125}],
    top_rate: .145, notes: "" },
  { code: "MB", name_fr: "Manitoba", form: "MB428", bpa_2025: 15780,
    brackets: [{up_to:36842,rate:.108},{up_to:79625,rate:.1275}],
    top_rate: .174, notes: "" },
  { code: "NB", name_fr: "Nouveau-Brunswick", form: "NB428", bpa_2025: 12458,
    brackets: [{up_to:47715,rate:.094},{up_to:95431,rate:.14},{up_to:176756,rate:.16}],
    top_rate: .195, notes: "" },
  { code: "NS", name_fr: "Nouvelle-Écosse", form: "NS428", bpa_2025: 8481,
    brackets: [{up_to:29590,rate:.0879},{up_to:59180,rate:.1495},{up_to:93000,rate:.1667},{up_to:150000,rate:.175}],
    top_rate: .21, notes: "" },
  { code: "PE", name_fr: "Île-du-Prince-Édouard", form: "PE428", bpa_2025: 12000,
    brackets: [{up_to:32656,rate:.096},{up_to:64313,rate:.137},{up_to:105000,rate:.167}],
    top_rate: .18, notes: "Surtaxe supprimée 2024." },
  { code: "NL", name_fr: "Terre-Neuve-et-Labrador", form: "NL428", bpa_2025: 10818,
    brackets: [{up_to:43198,rate:.087},{up_to:86395,rate:.145},{up_to:154244,rate:.158},{up_to:215943,rate:.178},{up_to:275870,rate:.198}],
    top_rate: .218, notes: "" },
  { code: "NT", name_fr: "Territoires du Nord-Ouest", form: "NT428", bpa_2025: 16593,
    brackets: [{up_to:50597,rate:.059},{up_to:101198,rate:.086},{up_to:164525,rate:.122}],
    top_rate: .1405, notes: "Crédit coût de la vie 942$." },
  { code: "NU", name_fr: "Nunavut", form: "NU428", bpa_2025: 17925,
    brackets: [{up_to:53268,rate:.04},{up_to:106537,rate:.07},{up_to:173205,rate:.09}],
    top_rate: .115, notes: "" },
  { code: "YT", name_fr: "Yukon", form: "YT428", bpa_2025: 15705,
    brackets: [{up_to:55867,rate:.064},{up_to:111733,rate:.09},{up_to:154906,rate:.109},{up_to:500000,rate:.128}],
    top_rate: .15, notes: "M&P 2,5%." },
];

// ── PATTERNS MONTANT (money_patterns du dictionnaire) ────────────────────────
export const MONEY_PATTERN_FR = /([0-9]{1,3}(?:[\s,\u00a0][0-9]{3})*(?:[.,][0-9]{2})(?!\d)|[0-9]+[.,][0-9]{2}(?!\d))/;
export const TABLE_ROW_PATTERN = /\b20\d{2}\s*[|\t]\s*([\d\s,.']+)/;

/**
 * Normaliser un montant OCR → nombre en cents
 * « 7 201,32 » → 720132
 * « 7,201.32 » → 720132
 * « 7201.32 »  → 720132
 */
export function parseMontantOCR(raw: string): number | null {
  if (!raw?.trim()) return null;
  // Supprimer symboles monétaires
  let s = raw.replace(/[$€¥£\s]/g, "");
  // FR: espace/nbsp comme séparateur de milliers, virgule décimale
  // EN: virgule comme séparateur de milliers, point décimal
  if (/\d,\d{2}$/.test(s) && !s.includes(".")) {
    // Format FR: 7201,32
    s = s.replace(",", ".");
  } else {
    // Format EN ou normalisé: supprimer virgules séparateurs
    s = s.replace(/,(?=\d{3})/g, "").replace(",", ".");
  }
  const num = parseFloat(s);
  if (isNaN(num) || num < 0) return null;
  return Math.round(num * 100);
}

/**
 * Chercher une case dans le texte OCR en utilisant ses keywords
 * Retourne le montant trouvé ou null
 */
export function findBoxValueInText(
  ocrText: string,
  box: BoxDef,
  slipCode: string
): string | null {
  const text = ocrText.toLowerCase();

  // 1. Chercher par code de case (ex: "box_14:", "case 14:", "14:")
  const codePatterns = [
    new RegExp(`box[_\\s]?${box.code}[:\\s]+([\\d\\s,.']+)`, "i"),
    new RegExp(`case[_\\s]?${box.code}[:\\s]+([\\d\\s,.']+)`, "i"),
    new RegExp(`^${box.code}[:\\s]+([\\d\\s,.']+)`, "im"),
  ];
  for (const pat of codePatterns) {
    const m = ocrText.match(pat);
    if (m?.[1] && parseMontantOCR(m[1]) !== null) return m[1].trim();
  }

  // 2. Chercher par keywords FR
  for (const kw of box.keywords_fr) {
    const idx = text.indexOf(kw.toLowerCase());
    if (idx >= 0) {
      const after = ocrText.slice(idx, idx + 100);
      const m = after.match(MONEY_PATTERN_FR);
      if (m?.[1]) return m[1].trim();
    }
  }

  // 3. Chercher dans les structured fields (section enrichie par Google Document AI)
  const structStart = ocrText.indexOf("--- STRUCTURED FIELDS ---");
  if (structStart >= 0) {
    const structText = ocrText.slice(structStart);
    const fieldKey = `box_${box.code}`;
    const pat = new RegExp(`${fieldKey}[:\\s]+([\\d\\s,.']+)`, "i");
    const m = structText.match(pat);
    if (m?.[1] && parseMontantOCR(m[1]) !== null) return m[1].trim();
  }

  // 4. Pattern tableau (Google Document AI tableau "2025 | montant | NAS | code")
  const tableMatch = ocrText.match(TABLE_ROW_PATTERN);
  if (tableMatch?.[1] && box.code === "14") {
    return tableMatch[1].trim();
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function getSlipDict(slipCode: string): SlipDef | null {
  return SLIP_DICT.find(s => s.code === slipCode) ?? null;
}

export function getBoxDef(slipCode: string, boxCode: string): BoxDef | null {
  const slip = getSlipDict(slipCode);
  return slip?.boxes.find(b => b.code === boxCode) ?? null;
}

export function getProvinceDef(provinceCode: string): ProvinceDef | null {
  return PROVINCE_DICT.find(p => p.code === provinceCode) ?? null;
}

// ── RÈGLES DE SEGMENTATION ───────────────────────────────────────────────────
export const SEGMENTATION_RULES = [
  "Ne jamais interpréter un numéro de case comme un montant (ex. « 024 048 » n'est pas 024,04$).",
  "Une case vide ne peut pas absorber le montant d'une autre case: la recherche s'arrête au prochain repère de case.",
  "L'année fiscale = l'année la plus fréquente sur le feuillet, pas la première.",
  "Les cents peuvent être dans une cellule adjacente (« 7,212 90 » = 7212.90$).",
  "Un feuillet combiné (T5007 + RL-5 dans le même PDF) se traite page par page.",
  "T5007 case 10 → inclusion 14400 PUIS déduction automatique 25000.",
  "T4A case 048 (honoraires) → revenu d'entreprise T2125 (13500) sauf indication contraire → 13000.",
];
