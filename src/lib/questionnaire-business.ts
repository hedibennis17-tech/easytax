/**
 * questionnaire-business.ts
 * 109 questions — Questionnaire fiscal 2025 — Entreprise
 * Source: Questionnaire_entreprise_2025.html
 * Bibliothèque SÉPARÉE — jamais mélangée avec le questionnaire individuel
 */

import type { Question, QuestionOption } from "./questionnaire-individual";
export type { Question };

// ─── TRIAGE ENTREPRISE (3 questions) ─────────────────────────────────────────

export const TRIAGE_BUSINESS: Question[] = [
  {
    id: "bt1", section: "triage_biz", order: 1,
    fr: "L'entreprise a-t-elle eu des employés en 2025 ?",
    en: "Did the business have employees in 2025?",
    type: "BOOLEAN", required: true,
  },
  {
    id: "bt2", section: "triage_biz", order: 2,
    fr: "L'entreprise est-elle inscrite aux taxes (TPS/TVH et/ou TVQ) ?",
    en: "Is the business registered for sales taxes (GST/HST and/or QST)?",
    type: "BOOLEAN", required: true,
  },
  {
    id: "bt3", section: "triage_biz", order: 3,
    fr: "L'entreprise a-t-elle acheté ou vendu des immobilisations en 2025 ? (véhicule, équipement, immeuble)",
    en: "Did the business buy or sell capital assets in 2025? (vehicle, equipment, building)",
    type: "BOOLEAN", required: true,
  },
];

// ─── MODULE IDENTIFICATION (12 questions) ─────────────────────────────────────

export const MODULE_IDENTIFICATION: Question[] = [
  { id: "bi1",  section: "identification", order: 1,  fr: "Dénomination sociale légale de l'entreprise", en: "Legal name of the business", type: "TEXT", required: true, placeholder: "Ex: 9876543 Canada Inc." },
  { id: "bi2",  section: "identification", order: 2,  fr: "Nom commercial (si différent de la dénomination sociale)", en: "Trade name (if different from the legal name)", type: "TEXT", required: false, placeholder: "Ex: Restaurant ABC" },
  { id: "bi3",  section: "identification", order: 3,  fr: "Numéro d'entreprise du Québec (NEQ, 10 chiffres)", en: "Québec enterprise number (NEQ, 10 digits)", type: "TEXT", required: false, placeholder: "1234567890" },
  { id: "bi4",  section: "identification", order: 4,  fr: "Numéro d'entreprise de l'ARC (9 chiffres)", en: "CRA business number (9 digits)", type: "TEXT", required: true, placeholder: "123456789" },
  { id: "bi5",  section: "identification", order: 5,  fr: "Comptes de programme ARC ouverts", en: "CRA program accounts open",
    type: "MULTI_CHOICE", required: false,
    options: [
      { value: "RT", fr: "RT — TPS/TVH",           en: "RT — GST/HST"       },
      { value: "RP", fr: "RP — Retenues salariales", en: "RP — Payroll deductions" },
      { value: "RC", fr: "RC — Impôt des sociétés",  en: "RC — Corporate tax" },
      { value: "RM", fr: "RM — Taxes d'accise",      en: "RM — Excise taxes"  },
    ],
  },
  { id: "bi6",  section: "identification", order: 6,  fr: "Début de l'exercice financier 2025", en: "Start of the 2025 fiscal year", type: "DATE", required: true },
  { id: "bi7",  section: "identification", order: 7,  fr: "Fin de l'exercice financier 2025", en: "End of the 2025 fiscal year", type: "DATE", required: true },
  { id: "bi8",  section: "identification", order: 8,  fr: "Adresse de l'établissement principal", en: "Address of the principal place of business", type: "ADDRESS", required: true },
  { id: "bi9",  section: "identification", order: 9,  fr: "Numéro de téléphone de l'entreprise", en: "Business telephone number", type: "TEXT", required: false, placeholder: "(514) 555-0000" },
  { id: "bi10", section: "identification", order: 10, fr: "Adresse courriel de l'entreprise", en: "Business email address", type: "TEXT", required: false },
  { id: "bi11", section: "identification", order: 11, fr: "Personne-contact (nom, titre, téléphone)", en: "Contact person (name, title, telephone)", type: "PERSON", required: false },
  { id: "bi12", section: "identification", order: 12, fr: "La déclaration T2 et CO-17 de l'exercice précédent a-t-elle été produite ?", en: "Was the prior year's T2 and CO-17 return filed?", type: "BOOLEAN", required: true },
];

// ─── MODULE STRUCTURE JURIDIQUE (10 questions) ────────────────────────────────

export const MODULE_STRUCTURE: Question[] = [
  { id: "bs1",  section: "structure", order: 1,  fr: "Forme juridique de l'entreprise", en: "Legal form of the business",
    type: "SINGLE_CHOICE", required: true,
    options: [
      { value: "corp",         fr: "Société par actions (SPA / Inc.)",   en: "Corporation (Inc.)"             },
      { value: "partnership",  fr: "Société de personnes",               en: "Partnership"                    },
      { value: "sole_prop",    fr: "Entreprise individuelle",            en: "Sole proprietorship"            },
      { value: "coop",         fr: "Coopérative",                       en: "Cooperative"                    },
      { value: "other",        fr: "Autre forme juridique",             en: "Other legal form"               },
    ],
  },
  { id: "bs2",  section: "structure", order: 2,  fr: "Date de constitution (ou d'immatriculation)", en: "Date of incorporation (or registration)", type: "DATE", required: false },
  { id: "bs3",  section: "structure", order: 3,  fr: "Juridiction de constitution", en: "Jurisdiction of incorporation",
    type: "SINGLE_CHOICE", required: false,
    options: [
      { value: "federal", fr: "Fédéral (Loi canadienne sur les sociétés)", en: "Federal (CBCA)" },
      { value: "QC",  fr: "Québec", en: "Quebec" }, { value: "ON", fr: "Ontario", en: "Ontario" },
      { value: "BC",  fr: "Colombie-Britannique", en: "BC" }, { value: "other", fr: "Autre", en: "Other" },
    ],
  },
  { id: "bs4",  section: "structure", order: 4,  fr: "Nombre d'actionnaires ou d'associés", en: "Number of shareholders or partners", type: "NUMBER", required: false, placeholder: "Ex: 2" },
  { id: "bs5",  section: "structure", order: 5,  fr: "Pour chaque actionnaire/associé : nom, NAS ou NE, pourcentage de participation, résident du Canada ?", en: "For each shareholder/partner: name, SIN or BN, ownership %, Canadian resident?", type: "PERSON", required: false },
  { id: "bs6",  section: "structure", order: 6,  fr: "Existe-t-il une convention entre actionnaires (ou entre associés) ?", en: "Is there a shareholder (or partnership) agreement?", type: "BOOLEAN", required: false },
  { id: "bs7",  section: "structure", order: 7,  fr: "Catégories d'actions émises (ex. : A votantes, B participantes)", en: "Classes of shares issued (e.g., voting Class A, participating Class B)", type: "TEXT", required: false },
  { id: "bs8",  section: "structure", order: 8,  fr: "L'exercice financier a-t-il changé par rapport à l'année précédente ?", en: "Did the fiscal year-end change from the prior year?", type: "BOOLEAN", required: false },
  { id: "bs9",  section: "structure", order: 9,  fr: "L'entreprise est-elle associée à d'autres sociétés (groupe de sociétés) ?", en: "Is the business associated with other corporations?", type: "BOOLEAN", required: false },
  { id: "bs10", section: "structure", order: 10, fr: "L'entreprise demande-t-elle la déduction pour petite entreprise (DPE) ?", en: "Does the business claim the small business deduction?", type: "BOOLEAN", required: false },
];

// ─── MODULE ACTIVITÉS (8 questions) ───────────────────────────────────────────

export const MODULE_ACTIVITES: Question[] = [
  { id: "ba1", section: "activites", order: 1, fr: "Description de l'activité principale", en: "Description of the principal business activity", type: "TEXT", required: true, placeholder: "Ex: Vente au détail de vêtements" },
  { id: "ba2", section: "activites", order: 2, fr: "Code SCIAN (6 chiffres) de l'activité principale", en: "NAICS code (6 digits) of the principal activity", type: "TEXT", required: false, placeholder: "Ex: 448110" },
  { id: "ba3", section: "activites", order: 3, fr: "Activités secondaires, le cas échéant", en: "Secondary activities, if any", type: "TEXT", required: false },
  { id: "ba4", section: "activites", order: 4, fr: "Date de début des activités de l'entreprise", en: "Date the business started operating", type: "DATE", required: false },
  { id: "ba5", section: "activites", order: 5, fr: "L'entreprise exerce-t-elle des activités à l'extérieur du Canada ?", en: "Does the business carry on activities outside Canada?", type: "BOOLEAN", required: false },
  { id: "ba6", section: "activites", order: 6, fr: "L'entreprise a-t-elle un établissement stable dans une autre province ou à l'étranger ?", en: "Does the business have a permanent establishment in another province or abroad?", type: "BOOLEAN", required: false },
  { id: "ba7", section: "activites", order: 7, fr: "Site Web de l'entreprise", en: "Business website", type: "TEXT", required: false, placeholder: "https://www.exemple.ca" },
  { id: "ba8", section: "activites", order: 8, fr: "L'activité est-elle saisonnière ?", en: "Is the activity seasonal?", type: "BOOLEAN", required: false },
];

// ─── MODULE REVENUS (12 questions) ────────────────────────────────────────────

export const MODULE_REVENUS_BIZ: Question[] = [
  { id: "br1",  section: "revenus_biz", order: 1,  fr: "Ventes brutes de biens (marchandises) — montant 2025", en: "Gross sales of goods — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "br2",  section: "revenus_biz", order: 2,  fr: "Ventes brutes de services — montant 2025", en: "Gross sales of services — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "br3",  section: "revenus_biz", order: 3,  fr: "Retours, rabais et escomptes accordés — montant 2025", en: "Returns, allowances and discounts granted — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "br4",  section: "revenus_biz", order: 4,  fr: "Revenus d'intérêts — montant 2025", en: "Interest income — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "br5",  section: "revenus_biz", order: 5,  fr: "Subventions reçues (gouvernementales ou autres) — montant 2025", en: "Grants received (government or other) — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "br6",  section: "revenus_biz", order: 6,  fr: "Revenus de location — montant 2025", en: "Rental income — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "br7",  section: "revenus_biz", order: 7,  fr: "Commissions gagnées — montant 2025", en: "Commissions earned — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "br8",  section: "revenus_biz", order: 8,  fr: "Autres revenus d'entreprise — montant 2025", en: "Other business income — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "br9",  section: "revenus_biz", order: 9,  fr: "Créances douteuses recouvrées — montant 2025", en: "Bad debts recovered — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "br10", section: "revenus_biz", order: 10, fr: "Chiffre d'affaires total 2025 (pour validation)", en: "Total 2025 revenue (for validation)", type: "MONEY", required: true, placeholder: "0,00 $" },
  { id: "br11", section: "revenus_biz", order: 11, fr: "Une partie des revenus a-t-elle été encaissée en espèces ?", en: "Was any revenue received in cash?", type: "BOOLEAN", required: false },
  { id: "br12", section: "revenus_biz", order: 12, fr: "Des ventes ont-elles été réalisées avec des personnes liées ?", en: "Were any sales made to related parties?", type: "BOOLEAN", required: false },
];

// ─── MODULE DÉPENSES (22 questions) ───────────────────────────────────────────

export const MODULE_DEPENSES: Question[] = [
  { id: "bd1",  section: "depenses", order: 1,  fr: "Publicité et promotion — montant 2025", en: "Advertising and promotion — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd2",  section: "depenses", order: 2,  fr: "Repas et divertissement — montant 2025 (50 % déductible)", en: "Meals and entertainment — 2025 amount (50% deductible)", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd3",  section: "depenses", order: 3,  fr: "Créances irrécouvrables — montant 2025", en: "Bad debts — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd4",  section: "depenses", order: 4,  fr: "Assurances (responsabilité, biens, etc.) — montant 2025", en: "Insurance (liability, property, etc.) — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd5",  section: "depenses", order: 5,  fr: "Intérêts et frais bancaires — montant 2025", en: "Interest and bank charges — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd6",  section: "depenses", order: 6,  fr: "Taxes d'affaires, permis et droits — montant 2025", en: "Business taxes, licences and fees — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd7",  section: "depenses", order: 7,  fr: "Entretien et réparations — montant 2025", en: "Maintenance and repairs — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd8",  section: "depenses", order: 8,  fr: "Honoraires professionnels (comptable, avocat, consultants) — montant 2025", en: "Professional fees (accountant, lawyer, consultants) — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd9",  section: "depenses", order: 9,  fr: "Loyer commercial — montant 2025", en: "Commercial rent — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd10", section: "depenses", order: 10, fr: "Fournitures de bureau — montant 2025", en: "Office supplies — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd11", section: "depenses", order: 11, fr: "Sous-traitants — montant 2025", en: "Subcontractors — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd12", section: "depenses", order: 12, fr: "Déplacements d'affaires (transport, hébergement) — montant 2025", en: "Business travel (transportation, lodging) — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd13", section: "depenses", order: 13, fr: "Frais de véhicule d'entreprise (essence, entretien, assurance) — montant 2025", en: "Business vehicle expenses (fuel, maintenance, insurance) — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd14", section: "depenses", order: 14, fr: "Services publics (électricité, chauffage, eau) — montant 2025", en: "Utilities (electricity, heating, water) — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd15", section: "depenses", order: 15, fr: "Télécommunications (téléphone, Internet) — montant 2025", en: "Telecommunications (telephone, Internet) — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd16", section: "depenses", order: 16, fr: "Formation et perfectionnement — montant 2025", en: "Training and professional development — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd17", section: "depenses", order: 17, fr: "Salaires et traitements (hors DAS) — montant 2025", en: "Salaries and wages (excluding payroll taxes) — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd18", section: "depenses", order: 18, fr: "Frais de gestion — montant 2025", en: "Management fees — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd19", section: "depenses", order: 19, fr: "Livraison, transport et messagerie — montant 2025", en: "Delivery, freight and courier — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd20", section: "depenses", order: 20, fr: "Logiciels et abonnements — montant 2025", en: "Software and subscriptions — 2025 amount", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd21", section: "depenses", order: 21, fr: "Autres dépenses d'exploitation — montant 2025 (préciser)", en: "Other operating expenses — 2025 amount (specify)", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bd22", section: "depenses", order: 22, fr: "Certaines dépenses comportent-elles un usage personnel (à rajuster) ?", en: "Do any expenses include personal use (to be adjusted)?", type: "BOOLEAN", required: false },
];

// ─── MODULE PAIE (11 questions) ───────────────────────────────────────────────

export const MODULE_PAIE: Question[] = [
  { id: "bp1",  section: "paie", order: 1,  fr: "Nombre d'employés en 2025 (y compris temps partiel)", en: "Number of employees in 2025 (including part-time)", type: "NUMBER", required: true, showIf: "bt1=true", placeholder: "Ex: 5" },
  { id: "bp2",  section: "paie", order: 2,  fr: "Masse salariale brute totale 2025", en: "Total 2025 gross payroll", type: "MONEY", required: true, showIf: "bt1=true", placeholder: "0,00 $" },
  { id: "bp3",  section: "paie", order: 3,  fr: "Des feuillets T4 et relevés 1 (RL-1) ont-ils été émis ?", en: "Were T4 slips and RL-1 slips issued?", type: "BOOLEAN", required: true, showIf: "bt1=true", documentRequired: "T4" },
  { id: "bp4",  section: "paie", order: 4,  fr: "Cotisations de l'employeur au RPC/RRQ — montant 2025", en: "Employer CPP/QPP contributions — 2025 amount", type: "MONEY", required: false, showIf: "bt1=true", placeholder: "0,00 $" },
  { id: "bp5",  section: "paie", order: 5,  fr: "Cotisations de l'employeur à l'assurance-emploi — montant 2025", en: "Employer employment insurance premiums — 2025 amount", type: "MONEY", required: false, showIf: "bt1=true", placeholder: "0,00 $" },
  { id: "bp6",  section: "paie", order: 6,  fr: "Cotisation au Fonds des services de santé (FSS, Québec) — montant 2025", en: "Health Services Fund (Québec) contribution — 2025 amount", type: "MONEY", required: false, showIf: "bt1=true", placeholder: "0,00 $" },
  { id: "bp7",  section: "paie", order: 7,  fr: "Primes CNESST (Québec) — montant 2025", en: "CNESST premiums (Québec) — 2025 amount", type: "MONEY", required: false, showIf: "bt1=true", placeholder: "0,00 $" },
  { id: "bp8",  section: "paie", order: 8,  fr: "Avantages imposables versés aux employés — montant 2025", en: "Taxable benefits paid to employees — 2025 amount", type: "MONEY", required: false, showIf: "bt1=true", placeholder: "0,00 $" },
  { id: "bp9",  section: "paie", order: 9,  fr: "Des actionnaires sont-ils aussi employés (salaire vs dividendes) ?", en: "Are any shareholders also employees (salary vs. dividends)?", type: "BOOLEAN", required: false, showIf: "bt1=true" },
  { id: "bp10", section: "paie", order: 10, fr: "Le compte de programme RP (retenues sur la paie) est-il actif ?", en: "Is the RP (payroll deductions) program account active?", type: "BOOLEAN", required: false, showIf: "bt1=true" },
  { id: "bp11", section: "paie", order: 11, fr: "Les DAS (déductions à la source) ont-ils été versés à temps ?", en: "Were source deductions remitted on time?", type: "BOOLEAN", required: false, showIf: "bt1=true" },
];

// ─── MODULE TPS/TVH/TVQ (11 questions) ───────────────────────────────────────

export const MODULE_TAXES: Question[] = [
  { id: "btx1",  section: "taxes", order: 1,  fr: "L'entreprise est-elle inscrite à la TVQ ?", en: "Is the business registered for QST?", type: "BOOLEAN", required: false, showIf: "bt2=true" },
  { id: "btx2",  section: "taxes", order: 2,  fr: "Numéro de TPS/TVH (9 chiffres + RT0001)", en: "GST/HST number (9 digits + RT0001)", type: "TEXT", required: false, showIf: "bt2=true", placeholder: "123456789RT0001" },
  { id: "btx3",  section: "taxes", order: 3,  fr: "Numéro de TVQ (10 chiffres + TQ0001)", en: "QST number (10 digits + TQ0001)", type: "TEXT", required: false, showIf: "btx1=true", placeholder: "1234567890TQ0001" },
  { id: "btx4",  section: "taxes", order: 4,  fr: "Fréquence de déclaration des taxes", en: "Sales tax filing frequency",
    type: "SINGLE_CHOICE", required: false, showIf: "bt2=true",
    options: [
      { value: "monthly",   fr: "Mensuelle",     en: "Monthly"    },
      { value: "quarterly", fr: "Trimestrielle", en: "Quarterly"  },
      { value: "annual",    fr: "Annuelle",      en: "Annual"     },
    ],
  },
  { id: "btx5",  section: "taxes", order: 5,  fr: "TPS/TVH perçue en 2025", en: "GST/HST collected in 2025", type: "MONEY", required: false, showIf: "bt2=true", placeholder: "0,00 $" },
  { id: "btx6",  section: "taxes", order: 6,  fr: "TVQ perçue en 2025", en: "QST collected in 2025", type: "MONEY", required: false, showIf: "btx1=true", placeholder: "0,00 $" },
  { id: "btx7",  section: "taxes", order: 7,  fr: "Crédits de taxe sur les intrants (CTI) demandés en 2025", en: "Input tax credits (ITCs) claimed in 2025", type: "MONEY", required: false, showIf: "bt2=true", placeholder: "0,00 $" },
  { id: "btx8",  section: "taxes", order: 8,  fr: "Remboursements de taxe sur les intrants (RTI, TVQ) demandés en 2025", en: "Input tax refunds (ITRs, QST) claimed in 2025", type: "MONEY", required: false, showIf: "btx1=true", placeholder: "0,00 $" },
  { id: "btx9",  section: "taxes", order: 9,  fr: "L'entreprise utilise-t-elle la méthode rapide de comptabilité ?", en: "Does the business use the quick method of accounting?", type: "BOOLEAN", required: false, showIf: "bt2=true" },
  { id: "btx10", section: "taxes", order: 10, fr: "Fournitures taxables totales 2025", en: "Total 2025 taxable supplies", type: "MONEY", required: false, showIf: "bt2=true", placeholder: "0,00 $" },
  { id: "btx11", section: "taxes", order: 11, fr: "Fournitures détaxées ou exonérées 2025", en: "2025 zero-rated or exempt supplies", type: "MONEY", required: false, showIf: "bt2=true", placeholder: "0,00 $" },
];

// ─── MODULE IMMOBILISATIONS (9 questions) ─────────────────────────────────────

export const MODULE_IMMO: Question[] = [
  { id: "bim1", section: "immo", order: 1, fr: "Description des immobilisations acquises", en: "Description of capital assets acquired", type: "TEXT", required: false, showIf: "bt3=true", placeholder: "Ex: Véhicule commercial, équipement informatique" },
  { id: "bim2", section: "immo", order: 2, fr: "Coût total des acquisitions 2025", en: "Total cost of 2025 acquisitions", type: "MONEY", required: false, showIf: "bt3=true", placeholder: "0,00 $" },
  { id: "bim3", section: "immo", order: 3, fr: "Catégorie de DPA applicable", en: "Applicable CCA class",
    type: "SINGLE_CHOICE", required: false, showIf: "bt3=true",
    options: [
      { value: "cat8",  fr: "Catégorie 8 — Mobilier, équipement (20 %)",       en: "Class 8 — Furniture, equipment (20%)"     },
      { value: "cat10", fr: "Catégorie 10 — Véhicules à moteur (30 %)",         en: "Class 10 — Motor vehicles (30%)"          },
      { value: "cat10a",fr: "Catégorie 10.1 — Voitures de tourisme > 36 000 $", en: "Class 10.1 — Passenger vehicles > $36,000" },
      { value: "cat12", fr: "Catégorie 12 — Outils, logiciels (100 %)",         en: "Class 12 — Tools, software (100%)"        },
      { value: "cat14", fr: "Catégorie 14 — Brevets, franchises",               en: "Class 14 — Patents, franchises"           },
      { value: "cat50", fr: "Catégorie 50 — Matériel informatique (55 %)",      en: "Class 50 — Computer equipment (55%)"      },
      { value: "other", fr: "Autre catégorie",                                  en: "Other class"                              },
    ],
  },
  { id: "bim4", section: "immo", order: 4, fr: "L'entreprise a-t-elle disposé (vendu) d'immobilisations en 2025 ?", en: "Did the business dispose of (sell) capital assets in 2025?", type: "BOOLEAN", required: false, showIf: "bt3=true" },
  { id: "bim5", section: "immo", order: 5, fr: "Produit de disposition total 2025", en: "Total 2025 disposition proceeds", type: "MONEY", required: false, showIf: "bim4=true", placeholder: "0,00 $" },
  { id: "bim6", section: "immo", order: 6, fr: "Coût en capital initial des biens cédés", en: "Original capital cost of disposed assets", type: "MONEY", required: false, showIf: "bim4=true", placeholder: "0,00 $" },
  { id: "bim7", section: "immo", order: 7, fr: "Y a-t-il une récupération d'amortissement ou une perte finale ?", en: "Is there recapture of depreciation or a terminal loss?", type: "BOOLEAN", required: false, showIf: "bim4=true" },
  { id: "bim8", section: "immo", order: 8, fr: "L'entreprise utilise-t-elle la règle de la demi-année pour les acquisitions 2025 ?", en: "Does the business apply the half-year rule to 2025 acquisitions?", type: "BOOLEAN", required: false, showIf: "bt3=true" },
  { id: "bim9", section: "immo", order: 9, fr: "Inventaire de fin d'exercice (marchandises)", en: "Year-end inventory (goods)", type: "MONEY", required: false, placeholder: "0,00 $" },
];

// ─── MODULE DOCUMENTS ENTREPRISE (6 questions) ────────────────────────────────

export const MODULE_DOCS_BIZ: Question[] = [
  { id: "bdoc1", section: "docs_biz", order: 1, fr: "États financiers (bilan et résultats) 2025 disponibles ?", en: "Are 2025 financial statements (balance sheet and income) available?", type: "BOOLEAN", required: true, documentRequired: "FINANCIAL_STATEMENTS" },
  { id: "bdoc2", section: "docs_biz", order: 2, fr: "Grand livre général 2025 disponible ?", en: "Is the 2025 general ledger available?", type: "BOOLEAN", required: false, documentRequired: "GENERAL_LEDGER" },
  { id: "bdoc3", section: "docs_biz", order: 3, fr: "T4 et RL-1 émis aux employés", en: "T4 and RL-1 issued to employees", type: "BOOLEAN", required: false, showIf: "bt1=true", documentRequired: "T4" },
  { id: "bdoc4", section: "docs_biz", order: 4, fr: "Déclarations TPS/TVH et TVQ 2025", en: "2025 GST/HST and QST returns", type: "BOOLEAN", required: false, showIf: "bt2=true", documentRequired: "GST_RETURNS" },
  { id: "bdoc5", section: "docs_biz", order: 5, fr: "Contrats et conventions importants (ventes, achats, emprunts)", en: "Important contracts and agreements (sales, purchases, loans)", type: "BOOLEAN", required: false },
  { id: "bdoc6", section: "docs_biz", order: 6, fr: "Autres documents pertinents à signaler", en: "Other relevant documents to report", type: "TEXT", required: false, placeholder: "Précisez..." },
];

// ─── MODULE VALIDATION ENTREPRISE (5 questions) ───────────────────────────────

export const MODULE_VALIDATION_BIZ: Question[] = [
  { id: "bv1", section: "validation_biz", order: 1, fr: "Avez-vous des dettes fiscales impayées auprès de l'ARC ou de Revenu Québec ?", en: "Do you have unpaid tax debts with CRA or Revenu Québec?", type: "BOOLEAN", required: false },
  { id: "bv2", section: "validation_biz", order: 2, fr: "Des acomptes provisionnels d'impôt ont-ils été versés en 2025 ?", en: "Were corporate income tax instalments paid in 2025?", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "bv3", section: "validation_biz", order: 3, fr: "Autorisez-vous votre préparateur à discuter de votre dossier avec l'ARC et Revenu Québec ?", en: "Do you authorize your preparer to discuss your file with CRA and Revenu Québec?", type: "BOOLEAN", required: false },
  { id: "bv4", section: "validation_biz", order: 4, fr: "Avez-vous des commentaires ou situations particulières à signaler ?", en: "Do you have any comments or special situations to report?", type: "TEXT", required: false, placeholder: "Décrivez toute situation particulière..." },
  { id: "bv5", section: "validation_biz", order: 5, fr: "Confirmez-vous que toutes les informations fournies sont complètes et exactes ?", en: "Do you confirm that all information provided is complete and accurate?", type: "BOOLEAN", required: true },
];

// ─── EXPORT CONSOLIDÉ ENTREPRISE ─────────────────────────────────────────────

// ─── Fonction avec module provincial ─────────────────────────────────────
export function getAllBusinessQuestionsWithProvince(): Question[] {
  return [...ALL_BUSINESS_QUESTIONS, ...MODULE_FISCALITE_PROVINCIALE];
}

export function getBusinessQuestionsForProvince(province: string): Question[] {
  return MODULE_FISCALITE_PROVINCIALE.filter(q =>
    !q.provinceOnly || q.provinceOnly.includes(province)
  );
}

export const ALL_BUSINESS_QUESTIONS: Question[] = [
  ...TRIAGE_BUSINESS,
  ...MODULE_IDENTIFICATION,
  ...MODULE_STRUCTURE,
  ...MODULE_ACTIVITES,
  ...MODULE_REVENUS_BIZ,
  ...MODULE_DEPENSES,
  ...MODULE_PAIE,
  ...MODULE_TAXES,
  ...MODULE_IMMO,
  ...MODULE_DOCS_BIZ,
  ...MODULE_VALIDATION_BIZ,
];

export const BUSINESS_SECTIONS = [
  { code: "triage_biz",    fr: "Triage",             en: "Triage",          icon: "🧭", alwaysShow: true    },
  { code: "identification",fr: "Identification",      en: "Identification",  icon: "🏢", alwaysShow: true    },
  { code: "structure",     fr: "Structure juridique", en: "Legal structure", icon: "⚖️",  alwaysShow: true    },
  { code: "activites",     fr: "Activités",           en: "Activities",      icon: "🏭", alwaysShow: true    },
  { code: "revenus_biz",   fr: "Revenus",             en: "Revenue",         icon: "💵", alwaysShow: true    },
  { code: "depenses",      fr: "Dépenses",            en: "Expenses",        icon: "🧾", alwaysShow: true    },
  { code: "paie",          fr: "Employés / Paie",     en: "Employees / Payroll", icon: "👥", showIf: "bt1=true" },
  { code: "taxes",         fr: "TPS/TVH / TVQ",       en: "GST/HST / QST",  icon: "🧮", showIf: "bt2=true"  },
  { code: "immo",          fr: "Immobilisations",     en: "Capital assets",  icon: "🚜", showIf: "bt3=true"  },
  { code: "fiscalite_prov", fr: "Fiscalité provinciale", en: "Provincial tax",  icon: "🏛️", alwaysShow: true    },
  { code: "docs_biz",      fr: "Documents",           en: "Documents",       icon: "📎", alwaysShow: true    },
  { code: "validation_biz",fr: "Validation",          en: "Validation",      icon: "✅", alwaysShow: true    },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE FISCALITÉ PROVINCIALE ENTREPRISES — 45 questions conditionnelles
// Source: Banque_de_questions_conditionnelles_par_province___Entreprises_2025.html
// Taux 2025 vérifiés (ARC, Revenu Québec, budgets provinciaux)
// ═══════════════════════════════════════════════════════════════════════════════

export const MODULE_FISCALITE_PROVINCIALE: Question[] = [

  // ── QUÉBEC — 8 questions ─────────────────────────────────────────────────
  // Taux 2025: général 11,5% · petites entreprises 3,2% (seuil 500 000$ + test 5 500h)
  // Déclaration CO-17 distincte (français uniquement) · Agence: Revenu Québec
  {
    id: "QC-E01", section: "fiscalite_prov", order: 501,
    fr: "La société a-t-elle totalisé au moins 5 500 heures rémunérées en 2025 (ou l'année précédente) ?",
    en: "Did the corporation total at least 5,500 remunerated hours in 2025 (or the previous year)?",
    type: "BOOLEAN", required: true,
    hint: "Sans 5 500 heures : aucune déduction pour petites entreprises QC. Réduction linéaire entre 5 000 et 5 500 h.",
    provinceOnly: ["QC"],
  },
  {
    id: "QC-E02", section: "fiscalite_prov", order: 502,
    fr: "La société a-t-elle engagé des dépenses de R-D, d'innovation ou de précommercialisation au Québec (exercices débutant après le 25 mars 2025) ? Quel montant ?",
    en: "Did the corporation incur R&D, innovation or pre-commercialization expenses in Québec (fiscal years starting after March 25, 2025)? What amount?",
    type: "MONEY", required: false,
    hint: "CRIC : 30% remboursable sur le premier 1 M$, 20% au-delà. Remplace 8 anciens crédits.",
    provinceOnly: ["QC"],
  },
  {
    id: "QC-E03", section: "fiscalite_prov", order: 503,
    fr: "La société exerce-t-elle des activités de développement des affaires électroniques intégrant l'IA dans une mesure importante (min. 6 employés à temps plein) ?",
    en: "Does the corporation carry on e-business development activities significantly integrating AI (min. 6 full-time employees)?",
    type: "BOOLEAN", required: false,
    hint: "CDAE-IA : 30% au total en 2025 (23% remb. + 7% non remb.).",
    provinceOnly: ["QC"],
  },
  {
    id: "QC-E04", section: "fiscalite_prov", order: 504,
    fr: "La société a-t-elle acquis de l'équipement ou des logiciels admissibles au Québec en 2025 (zone de vitalité économique) ? Quel montant ?",
    en: "Did the corporation acquire eligible equipment or software in Québec in 2025 (economic vitality zone)? What amount?",
    type: "MONEY", required: false,
    hint: "C3i remboursable : 15% / 20% / 25% selon la zone (jusqu'au 31 déc. 2029).",
    provinceOnly: ["QC"],
  },
  {
    id: "QC-E05", section: "fiscalite_prov", order: 505,
    fr: "La société a-t-elle engagé des dépenses de main-d'œuvre pour la production de titres multimédias au Québec en 2025 ? Quel montant ?",
    en: "Did the corporation incur labour expenses for multimedia title production in Québec in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Multimédia QC : 37,5% (avec version française) / 30% / 26,25%.",
    provinceOnly: ["QC"],
  },
  {
    id: "QC-E06", section: "fiscalite_prov", order: 506,
    fr: "La société a-t-elle engagé des dépenses de production cinématographique ou télévisuelle au Québec en 2025 (SODEC) ? Quel montant ?",
    en: "Did the corporation incur film or television production expenses in Québec in 2025 (SODEC)? What amount?",
    type: "MONEY", required: false,
    hint: "SODEC : 32%→40% (+8% animation/effets visuels, +8% régional). Services 25%+16%. Doublage 35%.",
    provinceOnly: ["QC"],
  },
  {
    id: "QC-E07", section: "fiscalite_prov", order: 507,
    fr: "La société réalise-t-elle un grand projet d'investissement au Québec (≥ 100 M$, ou 50 M$ en région désignée) ?",
    en: "Is the corporation carrying out a major investment project in Québec (≥ $100M, or $50M in a designated region)?",
    type: "BOOLEAN", required: false,
    hint: "Nouveau congé fiscal 10 ans : 15%/20%/25% des dépenses, plafond 1 G$.",
    provinceOnly: ["QC"],
  },
  {
    id: "QC-E08", section: "fiscalite_prov", order: 508,
    fr: "La société a-t-elle versé des salaires admissibles dans les médias écrits au Québec en 2025 ? Quel montant ?",
    en: "Did the corporation pay eligible print media wages in Québec in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Médias écrits QC : 35% (plafond 85 000$/employé).",
    provinceOnly: ["QC"],
  },

  // ── ONTARIO — 7 questions ────────────────────────────────────────────────
  // Taux 2025: général 11,5% · petites entreprises 3,2% (seuil 500 000$)
  // M&P 10% via crédit (pas un taux affiché) · T2 via ARC
  {
    id: "ON-E01", section: "fiscalite_prov", order: 511,
    fr: "La société a-t-elle engagé des dépenses admissibles de RS&DE en Ontario en 2025 ? Quel montant ?",
    en: "Did the corporation incur eligible SR&ED expenditures in Ontario in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "OITC 8% remboursable (max 3 M$ de dépenses) + ORDTC 3,5% non remboursable — empilables.",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-E02", section: "fiscalite_prov", order: 512,
    fr: "La société a-t-elle engagé des dépenses de R-D en vertu d'un contrat avec un institut de recherche admissible en Ontario en 2025 ? Quel montant ?",
    en: "Did the corporation incur R&D expenses under contract with an eligible research institute in Ontario in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "OBRITC 20% remboursable (max 4 M$/an).",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-E03", section: "fiscalite_prov", order: 513,
    fr: "La société a-t-elle engagé des dépenses de production cinématographique ou télévisuelle en Ontario en 2025 ? Quel montant ?",
    en: "Did the corporation incur film or television production expenses in Ontario in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "OFTTC 35% main-d'œuvre (+10% régional, 40% débutants) · OPSTC 21,5% all-spend · OCASE 18% animation.",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-E04", section: "fiscalite_prov", order: 514,
    fr: "La société a-t-elle développé des médias numériques interactifs (jeux vidéo) en Ontario en 2025 ? Quel montant de main-d'œuvre ?",
    en: "Did the corporation develop interactive digital media (video games) in Ontario in 2025? What labour amount?",
    type: "MONEY", required: false,
    hint: "OIDMTC 40% (produits non déterminés) / 35% (déterminés).",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-E05", section: "fiscalite_prov", order: 515,
    fr: "La société (SPCC) a-t-elle acquis des biens en capital admissibles entre le 15 mai 2025 et le 31 décembre 2029 ? Quel montant ?",
    en: "Did the corporation (CCPC) acquire eligible capital property between May 15, 2025 and December 31, 2029? What amount?",
    type: "MONEY", required: false,
    hint: "OMMITC 15% remboursable (nouveau 2025, temporaire, max 20 M$/an, jusqu'au 31 déc. 2029).",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-E06", section: "fiscalite_prov", order: 516,
    fr: "La société a-t-elle investi plus de 50 000 $ dans un bâtiment commercial ou industriel en région désignée de l'Ontario en 2025 ? Quel montant ?",
    en: "Did the corporation invest over $50,000 in a commercial or industrial building in a designated Ontario region in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "ROITC 10% remboursable (max 45 000$/an, aboli le 1er janv. 2027).",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-E07", section: "fiscalite_prov", order: 517,
    fr: "La société a-t-elle exercé des activités de fabrication et transformation en Ontario en 2025 ?",
    en: "Did the corporation carry on manufacturing and processing activities in Ontario in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Crédit M&P ON — taux effectif 10% (combiné fédéral + provincial).",
    provinceOnly: ["ON"],
  },

  // ── ALBERTA — 3 questions ────────────────────────────────────────────────
  // Taux 2025: général 8,0% (le plus bas au Canada) · PE 2,0% (seuil 500 000$)
  // Déclaration AT1 distincte (pas d'accord de perception avec l'ARC — comme QC)
  {
    id: "AB-E01", section: "fiscalite_prov", order: 521,
    fr: "La société a-t-elle engagé des dépenses de R-D admissibles en Alberta en 2025 ? Quel montant ?",
    en: "Did the corporation incur eligible R&D expenses in Alberta in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Innovation Employment Grant remboursable : 8% jusqu'au niveau de base + 20% sur le dépassement (plafond 4 M$ de dépenses/an). L'ancien crédit RS&DE albertain est aboli depuis 2020.",
    provinceOnly: ["AB"],
  },
  {
    id: "AB-E02", section: "fiscalite_prov", order: 522,
    fr: "La société a-t-elle engagé des coûts de production cinématographique ou télévisuelle en Alberta en 2025 (min. 500 000 $) ? Quel montant ?",
    en: "Did the corporation incur film or television production costs in Alberta in 2025 (min. $500,000)? What amount?",
    type: "MONEY", required: false,
    hint: "Film and Television Tax Credit AB remboursable : 22% ou 30% (plafond annuel 105 M$).",
    provinceOnly: ["AB"],
  },
  {
    id: "AB-E03", section: "fiscalite_prov", order: 523,
    fr: "La société est-elle constituée en Alberta (déclaration provinciale AT1 distincte de la T2 fédérale) ?",
    en: "Is the corporation incorporated in Alberta (separate provincial AT1 return)?",
    type: "BOOLEAN", required: true,
    hint: "L'Alberta administre son propre impôt des sociétés, comme le Québec. Déclaration AT1 obligatoire.",
    provinceOnly: ["AB"],
  },

  // ── COLOMBIE-BRITANNIQUE — 3 questions ──────────────────────────────────
  // Taux 2025: général 12,0% · PE 2,0% (seuil 500 000$) · M&P 12,0%
  {
    id: "BC-E01", section: "fiscalite_prov", order: 531,
    fr: "La société a-t-elle engagé des dépenses admissibles de RS&DE en Colombie-Britannique en 2025 ? Quel montant ?",
    en: "Did the corporation incur eligible SR&ED expenses in British Columbia in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit RS&DE C.-B. : 10% (remboursable si SPCC, non remboursable sinon). Incompatible avec IDMTC la même année.",
    provinceOnly: ["BC"],
  },
  {
    id: "BC-E02", section: "fiscalite_prov", order: 532,
    fr: "La société a-t-elle versé des salaires admissibles pour des médias numériques interactifs en C.-B. en 2025 ? Quel montant ?",
    en: "Did the corporation pay eligible interactive digital media salaries in B.C. in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "IDMTC remboursable : 17,5% jusqu'au 31 août 2025, puis 25% dès le 1er sept. 2025 (rendu permanent). Incompatible avec RS&DE la même année.",
    provinceOnly: ["BC"],
  },
  {
    id: "BC-E03", section: "fiscalite_prov", order: 533,
    fr: "La société a-t-elle engagé des dépenses de production cinématographique en C.-B. en 2025 (Film Incentive BC ou Production Services) ? Quel montant ?",
    en: "Did the corporation incur film production expenses in B.C. in 2025 (Film Incentive BC or Production Services)? What amount?",
    type: "MONEY", required: false,
    hint: "Film Incentive BC 35% (+12,5% régional, +6% région éloignée, +16% DAVE). Production Services 28% (+bonis).",
    provinceOnly: ["BC"],
  },

  // ── SASKATCHEWAN — 4 questions ───────────────────────────────────────────
  // Taux 2025: général 12,0% · PE 1,0% (seuil 600 000$ — le plus élevé CA) · M&P 10,0%
  // Tranche 500k$-600k$: 16% combiné (15% fédéral + 1% SK)
  {
    id: "SK-E01", section: "fiscalite_prov", order: 541,
    fr: "La société a-t-elle acquis des biens admissibles de fabrication et transformation en Saskatchewan en 2025 ? Quel coût en capital ?",
    en: "Did the corporation acquire eligible manufacturing and processing property in Saskatchewan in 2025? What capital cost?",
    type: "MONEY", required: false,
    hint: "Crédit d'investissement M&T SK : 6% entièrement remboursable.",
    provinceOnly: ["SK"],
  },
  {
    id: "SK-E02", section: "fiscalite_prov", order: 542,
    fr: "Des investisseurs ont-ils investi dans la société en 2025 (technologies, fabrication alimentaire/boissons, machinerie) ? Quel montant ?",
    en: "Did investors invest in the corporation in 2025 (technology, food/beverage manufacturing, machinery)? What amount?",
    type: "MONEY", required: false,
    hint: "STSI 45% non remboursable (plafond 7 M$/an, jusqu'au 31 mars 2027). SMEITC 45% non remboursable (pilote 1er juil. 2025–30 juin 2028, max 225 000$/an/investisseur).",
    provinceOnly: ["SK"],
  },
  {
    id: "SK-E03", section: "fiscalite_prov", order: 543,
    fr: "La société tire-t-elle des revenus de propriété intellectuelle commercialisée en Saskatchewan ? Quel montant ?",
    en: "Does the corporation earn income from intellectual property commercialized in Saskatchewan? What amount?",
    type: "MONEY", required: false,
    hint: "SCII (« patent box ») : taux provincial réduit à 6% pendant 10 ans sur les revenus de PI admissible.",
    provinceOnly: ["SK"],
  },
  {
    id: "SK-E04", section: "fiscalite_prov", order: 544,
    fr: "La société a-t-elle engagé des dépenses d'exploration minière en Saskatchewan en 2025 ? Quel montant ?",
    en: "Did the corporation incur mineral exploration expenses in Saskatchewan in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit d'exploration minière SK (SMETC) : 30%.",
    provinceOnly: ["SK"],
  },

  // ── MANITOBA — 4 questions ───────────────────────────────────────────────
  // Taux 2025: général 12,0% · PE 0% (seuil 500 000$) — seule province à 0%
  {
    id: "MB-E01", section: "fiscalite_prov", order: 551,
    fr: "La société a-t-elle acquis des biens admissibles de fabrication au Manitoba en 2025 (bâtiments, machinerie, équipement) ? Quel coût ?",
    en: "Did the corporation acquire eligible manufacturing property in Manitoba in 2025 (buildings, machinery, equipment)? What cost?",
    type: "MONEY", required: false,
    hint: "MITC 8% = 1% non remboursable + 7% remboursable (report 3 ans arrière / 10 ans avant).",
    provinceOnly: ["MB"],
  },
  {
    id: "MB-E02", section: "fiscalite_prov", order: 552,
    fr: "La société a-t-elle engagé des dépenses de R-D au Manitoba en 2025 ? Quel montant ?",
    en: "Did the corporation incur R&D expenses in Manitoba in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit R-D Manitoba : 20% partiellement remboursable.",
    provinceOnly: ["MB"],
  },
  {
    id: "MB-E03", section: "fiscalite_prov", order: 553,
    fr: "La société a-t-elle engagé des dépenses de production cinématographique ou vidéo au Manitoba en 2025 ? Quel montant (salaires admissibles et/ou coût de production) ?",
    en: "Did the corporation incur film or video production expenses in Manitoba in 2025? What amount (eligible salaries and/or production cost)?",
    type: "MONEY", required: false,
    hint: "Film/vidéo MB entièrement remboursable : 45% des salaires (jusqu'à 65% avec bonis) OU 30% du coût de production (+8% = 38% si producteur manitobain).",
    provinceOnly: ["MB"],
  },
  {
    id: "MB-E04", section: "fiscalite_prov", order: 554,
    fr: "La société a-t-elle engagé des dépenses admissibles de médias numériques interactifs au Manitoba en 2025 ? Quel montant ?",
    en: "Did the corporation incur eligible interactive digital media expenses in Manitoba in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "MIDMTC 40% remboursable (plafond 500 000$/projet).",
    provinceOnly: ["MB"],
  },

  // ── NOUVEAU-BRUNSWICK — 2 questions ─────────────────────────────────────
  // Taux 2025: général 14,0% · PE 2,5% (seuil 500 000$) · M&P 14,0%
  {
    id: "NB-E01", section: "fiscalite_prov", order: 561,
    fr: "La société a-t-elle engagé des dépenses admissibles de RS&DE au Nouveau-Brunswick en 2025 ? Quel montant ?",
    en: "Did the corporation incur eligible SR&ED expenses in New Brunswick in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit RS&DE NB : 15% entièrement remboursable (annexe T2SCH360).",
    provinceOnly: ["NB"],
  },
  {
    id: "NB-E02", section: "fiscalite_prov", order: 562,
    fr: "La société a-t-elle engagé des dépenses de production cinématographique ou télévisuelle au Nouveau-Brunswick en 2025 ? Quel montant ?",
    en: "Did the corporation incur film or television production expenses in New Brunswick in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Incitatif à la production NB (subvention, pas un crédit T2) : jusqu'à 40% des salaires (volet main-d'œuvre) ou 25%-30% all-spend.",
    provinceOnly: ["NB"],
  },

  // ── NOUVELLE-ÉCOSSE — 4 questions ────────────────────────────────────────
  // Taux 2025: général 14,0% · PE mixte 1,75% (2,5%→1,5% le 1er avr. 2025)
  // Plafond mixte 650 685$ (500k$→700k$ le 1er avr. 2025)
  // ⚠️ Exercice civil 2025 = taux mixte automatique dans le moteur
  {
    id: "NS-E01", section: "fiscalite_prov", order: 571,
    fr: "La société a-t-elle engagé des dépenses admissibles de RS&DE en Nouvelle-Écosse en 2025 ? Quel montant ?",
    en: "Did the corporation incur eligible SR&ED expenses in Nova Scotia in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit RS&DE NS : 15% entièrement remboursable.",
    provinceOnly: ["NS"],
  },
  {
    id: "NS-E02", section: "fiscalite_prov", order: 572,
    fr: "La société a-t-elle engagé des dépenses admissibles de médias numériques en Nouvelle-Écosse en 2025 ? Quel montant ?",
    en: "Did the corporation incur eligible digital media expenses in Nova Scotia in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Médias numériques NS : 50% remboursable (+10% en zone désignée, dépenses avant le 1er janv. 2031).",
    provinceOnly: ["NS"],
  },
  {
    id: "NS-E03", section: "fiscalite_prov", order: 573,
    fr: "La société a-t-elle engagé des dépenses d'animation numérique en Nouvelle-Écosse en 2025 (key animation) ? Quel montant ?",
    en: "Did the corporation incur digital animation expenses in Nova Scotia in 2025 (key animation)? What amount?",
    type: "MONEY", required: false,
    hint: "Animation NS : 50% + 17,5% de la main-d'œuvre d'animation (salaire admissible max 150 000$/employé).",
    provinceOnly: ["NS"],
  },
  {
    id: "NS-E04", section: "fiscalite_prov", order: 574,
    fr: "La société a-t-elle investi dans une PME innovante admissible de la Nouvelle-Écosse en 2025 ? Quel montant ?",
    en: "Did the corporation invest in an eligible innovative Nova Scotia SME in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Équité pour l'innovation NS : 15% non remboursable (investissement 50 000$–500 000$/an, report 3 ans arrière / 7 ans avant).",
    provinceOnly: ["NS"],
  },

  // ── ÎLE-DU-PRINCE-ÉDOUARD — 2 questions ─────────────────────────────────
  // Taux 2025: général 16%→15% (1er juil. 2025) · PE 1,0% (seuil 500k$→600k$ 1er juil.)
  // Aucun crédit RS&DE provincial à l'Î.-P.-É.
  {
    id: "PE-E01", section: "fiscalite_prov", order: 581,
    fr: "La société a-t-elle acquis des biens en capital admissibles à l'Î.-P.-É. en 2025 ? Quel coût ?",
    en: "Did the corporation acquire eligible capital property in P.E.I. in 2025? What cost?",
    type: "MONEY", required: false,
    hint: "Crédit d'impôt à l'investissement PE — non remboursable (taux à confirmer selon certificat provincial).",
    provinceOnly: ["PE"],
  },
  {
    id: "PE-E02", section: "fiscalite_prov", order: 582,
    fr: "La société a-t-elle créé des postes à temps plein à l'Î.-P.-É. en 2025 (salaire brut ≥ 35 000 $/an) ? Combien ?",
    en: "Did the corporation create full-time positions in P.E.I. in 2025 (gross salary ≥ $35,000/year)? How many?",
    type: "NUMBER", required: false,
    hint: "Innovation and Development Labour Rebate PE : remise de 25% des salaires admissibles (subvention provinciale, pas un crédit T2).",
    provinceOnly: ["PE"],
  },

  // ── TERRE-NEUVE-ET-LABRADOR — 4 questions ────────────────────────────────
  // Taux 2025: général 15,0% · PE 2,5% (seuil 500 000$) · M&P 15,0%
  // Crédits film/médias parmi les plus généreux au Canada
  {
    id: "NL-E01", section: "fiscalite_prov", order: 591,
    fr: "La société a-t-elle engagé des dépenses admissibles de RS&DE à Terre-Neuve-et-Labrador en 2025 ? Quel montant ?",
    en: "Did the corporation incur eligible SR&ED expenses in Newfoundland and Labrador in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit RS&DE NL : 15% remboursable.",
    provinceOnly: ["NL"],
  },
  {
    id: "NL-E02", section: "fiscalite_prov", order: 592,
    fr: "La société a-t-elle engagé des dépenses de production cinématographique ou vidéo à T.-N.-L. en 2025 ? Quel montant (salaires admissibles et/ou coûts totaux) ?",
    en: "Did the corporation incur film or video production expenses in N.L. in 2025? What amount (eligible salaries and/or total costs)?",
    type: "MONEY", required: false,
    hint: "Film NL remboursable : 40% (moindre de 40% des salaires ou 25% du budget, plafond 5 M$). Nouveau 2025 « all-spend » : 40% des coûts totaux, plafond 20 M$/projet.",
    provinceOnly: ["NL"],
  },
  {
    id: "NL-E03", section: "fiscalite_prov", order: 593,
    fr: "La société a-t-elle engagé des dépenses admissibles de médias numériques interactifs à T.-N.-L. en 2025 ? Quel montant ?",
    en: "Did the corporation incur eligible interactive digital media expenses in N.L. in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Médias numériques NL 40% remboursable (plafonds 40 000$/employé/an et 2 M$/société/an, permanent).",
    provinceOnly: ["NL"],
  },
  {
    id: "NL-E04", section: "fiscalite_prov", order: 594,
    fr: "La société a-t-elle investi dans des technologies vertes à T.-N.-L. en 2025 ? Quel montant ?",
    en: "Did the corporation invest in green technologies in N.L. in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit remboursable pour les technologies vertes NL.",
    provinceOnly: ["NL"],
  },

  // ── TERRITOIRES DU NORD-OUEST — 1 question ──────────────────────────────
  // Taux 2025: général 11,5% · PE 2,0% (seuil 500 000$) · Aucun changement 2025
  {
    id: "NT-E01", section: "fiscalite_prov", order: 601,
    fr: "La société a-t-elle versé des contributions politiques territoriales aux T.N.-O. en 2025 ? Quel montant ?",
    en: "Did the corporation make territorial political contributions in the N.W.T. in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit pour contributions politiques territoriales NT — max 500$ (100% des premiers 100$, 50% jusqu'à 900$).",
    provinceOnly: ["NT"],
  },

  // ── NUNAVUT — 1 question ─────────────────────────────────────────────────
  // Taux 2025: général 12,0% · PE 3,0% (seuil 500 000$) · Aucun changement 2025
  {
    id: "NU-E01", section: "fiscalite_prov", order: 611,
    fr: "La société a-t-elle versé des contributions politiques territoriales au Nunavut en 2025 ? Quel montant ?",
    en: "Did the corporation make territorial political contributions in Nunavut in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit pour contributions politiques territoriales NU — max 500$.",
    provinceOnly: ["NU"],
  },

  // ── YUKON — 2 questions ──────────────────────────────────────────────────
  // Taux 2025: général 12,0% · PE 0% (seuil 500 000$) · M&P 2,5% (seul territoire avec taux M&P réduit)
  // Taux combiné M&P: 17,5% (15% fédéral + 2,5% YT)
  {
    id: "YT-E01", section: "fiscalite_prov", order: 621,
    fr: "La société a-t-elle exercé des activités de fabrication et transformation au Yukon en 2025 ?",
    en: "Did the corporation carry on manufacturing and processing activities in Yukon in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Yukon = seul territoire avec un taux M&P distinct : 2,5% (combiné 17,5%). Très avantageux pour la fabrication.",
    provinceOnly: ["YT"],
  },
  {
    id: "YT-E02", section: "fiscalite_prov", order: 622,
    fr: "La société a-t-elle versé des contributions politiques territoriales au Yukon en 2025 ? Quel montant ?",
    en: "Did the corporation make territorial political contributions in Yukon in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit pour contributions politiques territoriales YT — max 650$.",
    provinceOnly: ["YT"],
  },
];
