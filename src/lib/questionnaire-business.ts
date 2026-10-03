/**
 * questionnaire-business.ts
 * 109 questions — Questionnaire fiscal 2025 — Entreprise
 * Source: Questionnaire_entreprise_2025.html
 * Bibliothèque SÉPARÉE — jamais mélangée avec le questionnaire individuel
 */

import type { Question } from "./questionnaire-individual";

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
  { code: "docs_biz",      fr: "Documents",           en: "Documents",       icon: "📎", alwaysShow: true    },
  { code: "validation_biz",fr: "Validation",          en: "Validation",      icon: "✅", alwaysShow: true    },
];
