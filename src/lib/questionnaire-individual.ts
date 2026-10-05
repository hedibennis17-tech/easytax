/**
 * questionnaire-individual.ts
 * 204 questions — Questionnaire fiscal 2025 — Particulier
 * Source: Questionnaire_individuel_2025.html
 *
 * Types de champs:
 * BOOLEAN     → Oui / Non (seulement quand c'est vraiment Oui/Non)
 * SINGLE_CHOICE → Liste déroulante (une option)
 * MULTI_CHOICE  → Choix multiples (cases à cocher)
 * TEXT          → Champ texte libre
 * NUMBER        → Nombre entier
 * MONEY         → Montant en dollars (format monétaire)
 * DATE          → Date picker
 * ADDRESS       → Champ adresse structuré
 * PERSON        → Bloc personne (nom, NAS, naissance, revenu)
 */

export type FieldType =
  | "BOOLEAN" | "SINGLE_CHOICE" | "MULTI_CHOICE"
  | "TEXT" | "NUMBER" | "MONEY" | "DATE" | "ADDRESS" | "PERSON" | "DOCUMENT";

export interface QuestionOption {
  value: string;
  fr: string;
  en: string;
}

export interface Question {
  id: string;
  section: string;
  order: number;
  fr: string;
  en: string;
  type: FieldType;
  required: boolean;
  hint?: string;
  hintEn?: string;
  showIf?: string;        // condition: "triage_X = oui" ou "question_id = valeur"
  options?: QuestionOption[];
  placeholder?: string;
  documentRequired?: string;
  provinceOnly?: string[];  // ["QC"] ou ["ON","BC"] — null = toutes provinces
  autoCalculated?: boolean; // true = calculé par le moteur sans poser la question
}

// ─── TRIAGE — 8 questions (province en premier, puis revenus) ────────────────
// La province détermine: TP-1 vs T1 seul, RL-1 vs T4, surtaxe ON, AT1 AB...

export const PROVINCE_OPTIONS: QuestionOption[] = [
  { value: "QC", fr: "Québec",                      en: "Quebec"                    },
  { value: "ON", fr: "Ontario",                      en: "Ontario"                   },
  { value: "AB", fr: "Alberta",                      en: "Alberta"                   },
  { value: "BC", fr: "Colombie-Britannique",         en: "British Columbia"          },
  { value: "SK", fr: "Saskatchewan",                 en: "Saskatchewan"              },
  { value: "MB", fr: "Manitoba",                     en: "Manitoba"                  },
  { value: "NB", fr: "Nouveau-Brunswick",            en: "New Brunswick"             },
  { value: "NS", fr: "Nouvelle-Écosse",              en: "Nova Scotia"               },
  { value: "PE", fr: "Île-du-Prince-Édouard",        en: "Prince Edward Island"      },
  { value: "NL", fr: "Terre-Neuve-et-Labrador",      en: "Newfoundland and Labrador" },
  { value: "NT", fr: "Territoires du Nord-Ouest",    en: "Northwest Territories"     },
  { value: "NU", fr: "Nunavut",                      en: "Nunavut"                   },
  { value: "YT", fr: "Yukon",                        en: "Yukon"                     },
];

export const TRIAGE: Question[] = [
  // ── Question 0: Province — détermine toute la suite ──────────────────────
  {
    id: "t0", section: "triage", order: 0,
    fr: "Dans quelle province ou territoire résidez-vous au 31 décembre 2025 ?",
    en: "In which province or territory do you reside on December 31, 2025?",
    hint: "Votre province de résidence au 31 décembre détermine votre déclaration provinciale.",
    hintEn: "Your province of residence on December 31 determines your provincial tax return.",
    type: "SINGLE_CHOICE", required: true,
    options: PROVINCE_OPTIONS,
  },
  // ── Questions 1-6: Types de revenus ──────────────────────────────────────
  {
    id: "t1", section: "triage", order: 1,
    fr: "Avez-vous eu un revenu d'emploi (salarié) en 2025 ?",
    en: "Did you have employment (salaried) income in 2025?",
    hint: "T4 d'un employeur, RL-1 au Québec.",
    hintEn: "T4 from an employer, RL-1 in Quebec.",
    type: "BOOLEAN", required: true,
  },
  {
    id: "t2", section: "triage", order: 2,
    fr: "Avez-vous eu des revenus de travail autonome en 2025 ? (Uber, DoorDash, freelance, contrats...)",
    en: "Did you have self-employment income in 2025? (Uber, DoorDash, freelance, contracts...)",
    hint: "Formulaire T2125 requis. T4A case 048.",
    type: "BOOLEAN", required: true,
  },
  {
    id: "t3", section: "triage", order: 3,
    fr: "Avez-vous perçu des revenus de location en 2025 ? (immeuble, logement, stationnement...)",
    en: "Did you earn rental income in 2025? (property, housing, parking...)",
    hint: "Formulaire T776. Revenus et dépenses de location.",
    type: "BOOLEAN", required: true,
  },
  {
    id: "t4", section: "triage", order: 4,
    fr: "Avez-vous eu des revenus de placements en 2025 ? (intérêts, dividendes, gains en capital, crypto)",
    en: "Did you have investment income in 2025? (interest, dividends, capital gains, crypto)",
    hint: "T5, T3, T5008. Comptes bancaires, actions, obligations.",
    type: "BOOLEAN", required: true,
  },
  {
    id: "t5", section: "triage", order: 5,
    fr: "Avez-vous touché d'autres revenus en 2025 ? (retraite, RPC/RRQ, AE, bourses, CNESST)",
    en: "Did you receive other income in 2025? (pension, CPP/QPP, EI, scholarships, workers comp)",
    hint: "T4A, T4A(P), T4A(OAS), T4E, T5007, RL-5.",
    type: "BOOLEAN", required: true,
  },
  {
    id: "t6", section: "triage", order: 6,
    fr: "Avez-vous un époux/conjoint de fait ou des personnes à charge (enfants, parents...) ?",
    en: "Do you have a spouse/common-law partner or dependants (children, parents...)?",
    hint: "Affecte plusieurs crédits d'impôt non remboursables.",
    type: "BOOLEAN", required: true,
  },
  // ── Question 7: Situation particulière ────────────────────────────────────
  {
    id: "t7", section: "triage", order: 7,
    fr: "Avez-vous vécu une situation particulière en 2025 ?",
    en: "Did you experience a special situation in 2025?",
    hint: "Immigration, émigration, décès, faillite, biens étrangers > 100 000 $.",
    type: "BOOLEAN", required: false,
  },
];

// ─── MODULE PROFIL (21 questions) ────────────────────────────────────────────

export const MODULE_PROFIL: Question[] = [
  {
    id: "p1", section: "profil", order: 1,
    fr: "Nom de famille", en: "Last name",
    type: "TEXT", required: true, placeholder: "Votre nom de famille",
  },
  {
    id: "p2", section: "profil", order: 2,
    fr: "Prénom et initiales", en: "First name and initials",
    type: "TEXT", required: true, placeholder: "Votre prénom",
  },
  {
    id: "p3", section: "profil", order: 3,
    fr: "Numéro d'assurance sociale (NAS, 9 chiffres)", en: "Social Insurance Number (SIN, 9 digits)",
    type: "TEXT", required: true, placeholder: "••• ••• •••",
    hint: "Le NAS est chiffré et sécurisé — jamais partagé",
  },
  {
    id: "p4", section: "profil", order: 4,
    fr: "Date de naissance", en: "Date of birth",
    type: "DATE", required: true,
  },
  {
    id: "p5", section: "profil", order: 5,
    fr: "Adresse de résidence au 31 décembre 2025", en: "Home address on December 31, 2025",
    type: "ADDRESS", required: true,
  },
  {
    id: "p6", section: "profil", order: 6,
    fr: "Adresse postale si différente de l'adresse de résidence", en: "Mailing address if different from home address",
    type: "ADDRESS", required: false,
  },
  {
    id: "p7", section: "profil", order: 7,
    fr: "Numéro de téléphone", en: "Phone number",
    type: "TEXT", required: false, placeholder: "(514) 555-0000",
  },
  {
    id: "p8", section: "profil", order: 8,
    fr: "Adresse courriel", en: "Email address",
    type: "TEXT", required: false, placeholder: "votre@courriel.ca",
  },
  {
    id: "p9", section: "profil", order: 9,
    fr: "Langue de correspondance souhaitée avec l'ARC", en: "Preferred language for CRA correspondence",
    type: "SINGLE_CHOICE", required: true,
    options: [
      { value: "fr", fr: "Français", en: "French" },
      { value: "en", fr: "Anglais", en: "English" },
    ],
  },
  {
    id: "p10", section: "profil", order: 10,
    fr: "Langue de correspondance souhaitée avec Revenu Québec", en: "Preferred language for Revenu Québec correspondence",
    type: "SINGLE_CHOICE", required: false,
    options: [
      { value: "fr", fr: "Français", en: "French" },
      { value: "en", fr: "Anglais", en: "English" },
    ],
  },
  {
    id: "p11", section: "profil", order: 11,
    fr: "Statut au Canada", en: "Status in Canada",
    type: "SINGLE_CHOICE", required: true,
    options: [
      { value: "citizen",   fr: "Citoyen canadien",          en: "Canadian citizen"     },
      { value: "pr",        fr: "Résident permanent",        en: "Permanent resident"   },
      { value: "work",      fr: "Permis de travail",         en: "Work permit"          },
      { value: "study",     fr: "Permis d'études",           en: "Study permit"         },
      { value: "refugee",   fr: "Demandeur d'asile",         en: "Refugee claimant"     },
      { value: "other",     fr: "Autre",                     en: "Other"                },
    ],
  },
  {
    id: "p12", section: "profil", order: 12,
    fr: "Êtes-vous un Indien inscrit au sens de la Loi sur les Indiens ?", en: "Are you a registered Indian under the Indian Act?",
    type: "BOOLEAN", required: false,
  },
  {
    id: "p13", section: "profil", order: 13,
    fr: "Si oui : l'employeur et le lieu de travail sont-ils situés sur une réserve ?", en: "If yes: are the employer and workplace located on a reserve?",
    type: "BOOLEAN", required: false, showIf: "p12=true",
  },
  {
    id: "p14", section: "profil", order: 14,
    fr: "Dans quelle province ou territoire résidez-vous au 31 décembre 2025 ?", en: "In which province or territory do you reside?",
    type: "SINGLE_CHOICE", required: true,
    options: [
      { value: "QC", fr: "Québec",                      en: "Quebec"                      },
      { value: "ON", fr: "Ontario",                     en: "Ontario"                     },
      { value: "BC", fr: "Colombie-Britannique",        en: "British Columbia"            },
      { value: "AB", fr: "Alberta",                     en: "Alberta"                     },
      { value: "SK", fr: "Saskatchewan",               en: "Saskatchewan"               },
      { value: "MB", fr: "Manitoba",                    en: "Manitoba"                    },
      { value: "NB", fr: "Nouveau-Brunswick",           en: "New Brunswick"               },
      { value: "NS", fr: "Nouvelle-Écosse",             en: "Nova Scotia"                 },
      { value: "PE", fr: "Île-du-Prince-Édouard",       en: "Prince Edward Island"        },
      { value: "NL", fr: "Terre-Neuve-et-Labrador",    en: "Newfoundland and Labrador"   },
      { value: "NT", fr: "Territoires du Nord-Ouest",  en: "Northwest Territories"       },
      { value: "NU", fr: "Nunavut",                     en: "Nunavut"                     },
      { value: "YT", fr: "Yukon",                       en: "Yukon"                       },
    ],
  },
  {
    id: "p15", section: "profil", order: 15,
    fr: "Est-ce votre première déclaration de revenus au Canada ?", en: "Is this your first income tax return in Canada?",
    type: "BOOLEAN", required: true,
  },
  {
    id: "p16", section: "profil", order: 16,
    fr: "Avez-vous déménagé dans une autre province ou un autre territoire en 2025 ?", en: "Did you move to another province or territory in 2025?",
    type: "BOOLEAN", required: false,
  },
  {
    id: "p17", section: "profil", order: 17,
    fr: "Avez-vous immigré au Canada en 2025 ?", en: "Did you immigrate to Canada in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Si oui, précisez la date d'arrivée et le pays de provenance",
  },
  {
    id: "p18", section: "profil", order: 18,
    fr: "Avez-vous émigré du Canada en 2025 ?", en: "Did you emigrate from Canada in 2025?",
    type: "BOOLEAN", required: false,
  },
  {
    id: "p19", section: "profil", order: 19,
    fr: "Étiez-vous non-résident du Canada pendant une partie de 2025 ?", en: "Were you a non-resident of Canada for part of 2025?",
    type: "BOOLEAN", required: false,
  },
  {
    id: "p20", section: "profil", order: 20,
    fr: "Avez-vous été en faillite en 2025 ?", en: "Were you bankrupt in 2025?",
    type: "BOOLEAN", required: false,
  },
  {
    id: "p21", section: "profil", order: 21,
    fr: "Cette déclaration est-elle produite pour une personne décédée en 2025 ?", en: "Is this return filed for a person who died in 2025?",
    type: "BOOLEAN", required: false,
  },
];

// ─── MODULE FAMILLE (6 questions) ────────────────────────────────────────────

export const MODULE_FAMILLE: Question[] = [
  {
    id: "f1", section: "famille", order: 1,
    fr: "Quelle était votre situation matrimoniale au 31 décembre 2025 ?", en: "What was your marital status on December 31, 2025?",
    type: "SINGLE_CHOICE", required: true, showIf: "t6=true",
    options: [
      { value: "married",     fr: "Marié(e)",                     en: "Married"                  },
      { value: "common_law",  fr: "Conjoint(e) de fait",          en: "Common-law partner"       },
      { value: "separated",   fr: "Séparé(e)",                    en: "Separated"                },
      { value: "divorced",    fr: "Divorcé(e)",                   en: "Divorced"                 },
      { value: "widowed",     fr: "Veuf / veuve",                 en: "Widowed"                  },
      { value: "single",      fr: "Célibataire",                  en: "Single"                   },
    ],
  },
  {
    id: "f2", section: "famille", order: 2,
    fr: "Si votre état civil a changé en 2025 : date du changement", en: "If your marital status changed in 2025: date of change",
    type: "DATE", required: false, showIf: "t6=true",
  },
  {
    id: "f3", section: "famille", order: 3,
    fr: "Renseignements sur l'époux ou conjoint de fait", en: "Spouse or common-law partner details",
    type: "PERSON", required: false, showIf: "t6=true",
    hint: "Nom, NAS, date de naissance, revenu net 2025, produit-il/elle une déclaration ?",
    hintEn: "Name, SIN, birth date, net income 2025, filing a return?",
  },
  {
    id: "f4", section: "famille", order: 4,
    fr: "Avez-vous des personnes à charge ?", en: "Do you have any dependants?",
    type: "BOOLEAN", required: true, showIf: "t6=true",
  },
  {
    id: "f5", section: "famille", order: 5,
    fr: "Combien de personnes à charge avez-vous ?", en: "How many dependants do you have?",
    type: "NUMBER", required: true, showIf: "f4=true",
  },
  {
    id: "f6", section: "famille", order: 6,
    fr: "Pour chaque personne à charge : nom, lien de parenté, date de naissance, NAS, revenu net, vit avec vous, déficience, études",
    en: "For each dependant: name, relationship, birth date, SIN, net income, lives with you, disability, studies",
    type: "PERSON", required: true, showIf: "f4=true",
    hint: "Vous pourrez ajouter autant de personnes à charge que nécessaire",
  },
];

// ─── MODULE EMPLOI (7 questions) ─────────────────────────────────────────────

export const MODULE_EMPLOI: Question[] = [
  {
    id: "e1", section: "emploi", order: 1,
    fr: "Combien d'employeurs avez-vous eus en 2025 ?", en: "How many employers did you have in 2025?",
    type: "NUMBER", required: true, showIf: "t1=true",
  },
  {
    id: "e2", section: "emploi", order: 2,
    fr: "Avez-vous reçu un T4 de votre employeur ?", en: "Did you receive a T4 from your employer?",
    type: "BOOLEAN", required: true, showIf: "t1=true",
    documentRequired: "T4",
  },
  {
    id: "e3", section: "emploi", order: 3,
    fr: "Avez-vous reçu des pourboires non indiqués sur vos feuillets T4 ? (montant)", en: "Did you receive tips not shown on your T4 slips? (amount)",
    type: "MONEY", required: false, showIf: "t1=true",
    placeholder: "0,00 $",
  },
  {
    id: "e4", section: "emploi", order: 4,
    fr: "Avez-vous gagné des commissions ? Sont-elles indiquées sur le T4 ?", en: "Did you earn commissions? Are they shown on the T4?",
    type: "BOOLEAN", required: false, showIf: "t1=true",
  },
  {
    id: "e5", section: "emploi", order: 5,
    fr: "Avez-vous exercé des options d'achat d'actions de votre employeur en 2025 ?", en: "Did you exercise employee stock options in 2025?",
    type: "BOOLEAN", required: false, showIf: "t1=true",
  },
  {
    id: "e6", section: "emploi", order: 6,
    fr: "Avez-vous reçu des feuillets T4A (bourses, subventions, case 048, etc.) ?", en: "Did you receive T4A slips (scholarships, grants, box 048, etc.)?",
    type: "BOOLEAN", required: false, showIf: "t1=true",
    documentRequired: "T4A",
  },
  {
    id: "e7", section: "emploi", order: 7,
    fr: "Votre employeur vous a-t-il signé un T2200 (dépenses d'emploi) ?", en: "Did your employer sign a T2200 (employment expenses)?",
    type: "BOOLEAN", required: false, showIf: "t1=true",
    documentRequired: "T2200",
  },
];

// ─── MODULE TRAVAIL AUTONOME (14 questions) ──────────────────────────────────

export const MODULE_AUTONOME: Question[] = [
  {
    id: "a1", section: "autonome", order: 1,
    fr: "Type d'activité autonome", en: "Type of self-employment activity",
    type: "MULTI_CHOICE", required: true, showIf: "t2=true",
    options: [
      { value: "sole_prop",     fr: "Entreprise individuelle",       en: "Sole proprietorship"    },
      { value: "professional",  fr: "Profession libérale",           en: "Professional practice"  },
      { value: "commission",    fr: "Commissions (vendeur autonome)", en: "Self-employed commissions" },
      { value: "uber",          fr: "Uber / DoorDash / livraison",   en: "Uber / DoorDash / delivery" },
      { value: "freelance",     fr: "Freelance / contrats",          en: "Freelance / contracts"  },
      { value: "farming",       fr: "Agriculture",                   en: "Farming"                },
      { value: "fishing",       fr: "Pêche",                        en: "Fishing"                },
      { value: "partnership",   fr: "Associé d'une société de personnes", en: "Partnership member" },
    ],
  },
  {
    id: "a2", section: "autonome", order: 2,
    fr: "Nom commercial et numéro d'entreprise (NEQ au Québec, ou NE de l'ARC)", en: "Business name and business number (NEQ in Québec, or CRA BN)",
    type: "TEXT", required: false, showIf: "t2=true",
    placeholder: "Ex: Restauration XYZ / 1234567890",
  },
  {
    id: "a3", section: "autonome", order: 3,
    fr: "Date de début de l'activité en 2025", en: "Start date of the activity in 2025",
    type: "DATE", required: false, showIf: "t2=true",
  },
  {
    id: "a4", section: "autonome", order: 4,
    fr: "Revenus bruts de l'entreprise en 2025", en: "Gross business income in 2025",
    type: "MONEY", required: true, showIf: "t2=true",
    placeholder: "0,00 $",
    hint: "Avant déduction des dépenses d'entreprise",
  },
  {
    id: "a5", section: "autonome", order: 5,
    fr: "Méthode comptable", en: "Accounting method",
    type: "SINGLE_CHOICE", required: false, showIf: "t2=true",
    options: [
      { value: "accrual", fr: "Exercice (comptabilité d'engagement)", en: "Accrual basis" },
      { value: "cash",    fr: "Caisse (encaissements/décaissements)",  en: "Cash basis"    },
    ],
  },
  {
    id: "a6", section: "autonome", order: 6,
    fr: "Avez-vous des dépenses d'entreprise à déclarer ?", en: "Do you have business expenses to claim?",
    type: "BOOLEAN", required: true, showIf: "t2=true",
  },
  {
    id: "a7", section: "autonome", order: 7,
    fr: "Dépenses d'entreprise 2025 — publicité", en: "Business expenses 2025 — advertising",
    type: "MONEY", required: false, showIf: "a6=true", placeholder: "0,00 $",
  },
  {
    id: "a8", section: "autonome", order: 8,
    fr: "Dépenses d'entreprise 2025 — assurances", en: "Business expenses 2025 — insurance",
    type: "MONEY", required: false, showIf: "a6=true", placeholder: "0,00 $",
  },
  {
    id: "a9", section: "autonome", order: 9,
    fr: "Dépenses d'entreprise 2025 — repas et représentation (50 % déductible)", en: "Business expenses 2025 — meals and entertainment (50% deductible)",
    type: "MONEY", required: false, showIf: "a6=true", placeholder: "0,00 $",
  },
  {
    id: "a10", section: "autonome", order: 10,
    fr: "Inventaire de fin d'année (marchandises, travaux en cours)", en: "Year-end inventory (goods, work in progress)",
    type: "MONEY", required: false, showIf: "t2=true", placeholder: "0,00 $",
  },
  {
    id: "a11", section: "autonome", order: 11,
    fr: "Utilisez-vous un véhicule pour l'entreprise ?", en: "Do you use a vehicle for the business?",
    type: "BOOLEAN", required: false, showIf: "t2=true",
  },
  {
    id: "a12", section: "autonome", order: 12,
    fr: "Kilomètres totaux parcourus en 2025", en: "Total kilometres driven in 2025",
    type: "NUMBER", required: false, showIf: "a11=true", placeholder: "Ex: 25 000",
  },
  {
    id: "a13", section: "autonome", order: 13,
    fr: "Utilisez-vous une partie de votre domicile comme bureau d'affaires ?", en: "Do you use part of your home as a business office?",
    type: "BOOLEAN", required: false, showIf: "t2=true",
    hint: "Superficie du bureau / superficie totale du logement",
  },
  {
    id: "a14", section: "autonome", order: 14,
    fr: "Êtes-vous inscrit aux taxes (TPS/TVH/TVQ) ?", en: "Are you registered for GST/HST/QST?",
    type: "BOOLEAN", required: false, showIf: "t2=true",
    hint: "Obligatoire si revenus > 30 000 $ sur 4 trimestres consécutifs",
  },
];

// ─── MODULE LOCATION (4 questions) ───────────────────────────────────────────

export const MODULE_LOCATION: Question[] = [
  {
    id: "l1", section: "location", order: 1,
    fr: "Pour chaque immeuble loué : adresse, nombre de logements, loyers bruts", en: "For each rental property: address, number of units, gross rents",
    type: "TEXT", required: true, showIf: "t3=true",
    hint: "Ajoutez autant de propriétés que nécessaire",
  },
  {
    id: "l2", section: "location", order: 2,
    fr: "Revenus de location bruts totaux 2025", en: "Total gross rental income 2025",
    type: "MONEY", required: true, showIf: "t3=true", placeholder: "0,00 $",
  },
  {
    id: "l3", section: "location", order: 3,
    fr: "Dépenses de location 2025 (assurances, intérêts hypothécaires, entretien, taxes, services publics)",
    en: "Rental expenses 2025 (insurance, mortgage interest, maintenance, taxes, utilities)",
    type: "TEXT", required: false, showIf: "t3=true",
    hint: "Précisez le montant par catégorie de dépense",
  },
  {
    id: "l4", section: "location", order: 4,
    fr: "Quote-part de copropriété (indivision ou société de personnes)", en: "Co-ownership share (undivided or partnership)",
    type: "MONEY", required: false, showIf: "t3=true", placeholder: "0,00 $",
  },
];

// ─── MODULE PLACEMENTS (10 questions) ────────────────────────────────────────

export const MODULE_PLACEMENTS: Question[] = [
  {
    id: "inv1", section: "placements", order: 1,
    fr: "Avez-vous un revenu de placement ? (T5, dividendes, etc.)", en: "Do you have investment income? (T5, dividends, etc.)",
    type: "BOOLEAN", required: true, showIf: "t4=true",
    documentRequired: "T5",
  },
  {
    id: "inv2", section: "placements", order: 2,
    fr: "Avez-vous gagné des intérêts ou dividendes de source étrangère ?", en: "Did you earn foreign interest or dividends?",
    type: "BOOLEAN", required: false, showIf: "t4=true",
    hint: "Précisez le pays, les montants et l'impôt étranger retenu",
  },
  {
    id: "inv3", section: "placements", order: 3,
    fr: "Avez-vous des biens étrangers dont le coût total dépasse 100 000 $ CA ? (T1135)", en: "Do you own foreign property costing over CAD $100,000? (T1135)",
    type: "BOOLEAN", required: false, showIf: "t4=true",
    documentRequired: "T1135",
  },
  {
    id: "inv4", section: "placements", order: 4,
    fr: "Avez-vous effectué des transactions en cryptomonnaies en 2025 ?", en: "Did you transact in cryptocurrency in 2025?",
    type: "BOOLEAN", required: false, showIf: "t4=true",
    hint: "Achat, vente, échange — précisez les gains/pertes",
  },
  {
    id: "inv5", section: "placements", order: 5,
    fr: "Avez-vous vendu en 2025 des actions, obligations, fonds, immeubles ou autres immobilisations ?", en: "Did you sell stocks, bonds, funds, real estate or other capital property in 2025?",
    type: "BOOLEAN", required: false, showIf: "t4=true",
  },
  {
    id: "inv6", section: "placements", order: 6,
    fr: "Pour chaque disposition : description, dates, produit de disposition, prix de base rajusté, frais",
    en: "For each disposition: description, dates, proceeds, adjusted cost base, expenses",
    type: "TEXT", required: false, showIf: "inv5=true",
    hint: "Remplissez une ligne par bien vendu",
  },
  {
    id: "inv7", section: "placements", order: 7,
    fr: "Avez-vous vendu votre résidence principale en 2025 ? (T2091)", en: "Did you sell your principal residence in 2025? (T2091)",
    type: "BOOLEAN", required: false, showIf: "t4=true",
    documentRequired: "T2091",
  },
  {
    id: "inv8", section: "placements", order: 8,
    fr: "Déclarez-vous une provision pour gains en capital (solde de prix de vente à recevoir) ?",
    en: "Are you claiming a capital gains reserve (unpaid sale proceeds)?",
    type: "BOOLEAN", required: false, showIf: "t4=true",
  },
  {
    id: "inv9", section: "placements", order: 9,
    fr: "Avez-vous vendu des actions admissibles de petite entreprise ou biens agricoles/de pêche (ECGC, plafond 1 250 000 $) ?",
    en: "Did you sell qualified small business shares or farm/fishing property (LCGE, $1,250,000 limit)?",
    type: "BOOLEAN", required: false, showIf: "t4=true",
  },
  {
    id: "inv10", section: "placements", order: 10,
    fr: "Avez-vous subi des pertes en capital en 2025 ou des pertes inutilisées d'années antérieures ?",
    en: "Did you incur capital losses in 2025 or have unused prior-year losses?",
    type: "BOOLEAN", required: false, showIf: "t4=true",
  },
];

// ─── MODULE AUTRES REVENUS (23 questions) ────────────────────────────────────

export const MODULE_AUTRES_REVENUS: Question[] = [
  { id: "r1",  section: "autres_revenus", order: 1,  fr: "Avez-vous reçu une allocation de retraite (indemnité de départ) ? Montant, transfert REER ?", en: "Did you receive a retiring allowance? Amount, RRSP transfer?", type: "MONEY", required: false, showIf: "t5=true", placeholder: "0,00 $" },
  { id: "r2",  section: "autres_revenus", order: 2,  fr: "Avez-vous gagné un revenu d'emploi à l'extérieur du Canada ?", en: "Did you earn employment income outside Canada?", type: "BOOLEAN", required: false, showIf: "t5=true", hint: "Précisez le pays, le montant et l'impôt étranger retenu" },
  { id: "r3",  section: "autres_revenus", order: 3,  fr: "Recevez-vous la pension de la Sécurité de la vieillesse (SV) ?", en: "Do you receive Old Age Security (OAS)?", type: "BOOLEAN", required: false, showIf: "t5=true", documentRequired: "T4A(OAS)" },
  { id: "r4",  section: "autres_revenus", order: 4,  fr: "Recevez-vous une rente du RPC ou du RRQ ?", en: "Do you receive CPP or QPP benefits?", type: "BOOLEAN", required: false, showIf: "t5=true", documentRequired: "T4A(P)" },
  { id: "r5",  section: "autres_revenus", order: 5,  fr: "Avez-vous effectué des retraits d'un REER en 2025 ?", en: "Did you withdraw from an RRSP in 2025?", type: "MONEY", required: false, showIf: "t5=true", placeholder: "0,00 $", documentRequired: "T4RSP" },
  { id: "r6",  section: "autres_revenus", order: 6,  fr: "Avez-vous effectué des retraits d'un FERR en 2025 ?", en: "Did you withdraw from a RRIF in 2025?", type: "MONEY", required: false, showIf: "t5=true", placeholder: "0,00 $", documentRequired: "T4RIF" },
  { id: "r7",  section: "autres_revenus", order: 7,  fr: "Avez-vous effectué des retraits d'un CELIAPP ? S'agissait-il de retraits admissibles ?", en: "Did you withdraw from an FHSA? Were they qualifying withdrawals?", type: "BOOLEAN", required: false, showIf: "t5=true", documentRequired: "T4FHSA" },
  { id: "r8",  section: "autres_revenus", order: 8,  fr: "Recevez-vous une pension d'un régime de retraite d'employeur ou une rente ?", en: "Do you receive an employer pension plan pension or annuity?", type: "BOOLEAN", required: false, showIf: "t5=true" },
  { id: "r9",  section: "autres_revenus", order: 9,  fr: "Recevez-vous une pension d'un pays étranger ?", en: "Do you receive a pension from a foreign country?", type: "BOOLEAN", required: false, showIf: "t5=true", hint: "Précisez le pays, le montant brut et l'impôt retenu" },
  { id: "r10", section: "autres_revenus", order: 10, fr: "Désirez-vous fractionner votre revenu de pension avec votre époux/conjoint (T1032) ?", en: "Do you want to split eligible pension income with your spouse (T1032)?", type: "BOOLEAN", required: false, showIf: "t5=true" },
  { id: "r11", section: "autres_revenus", order: 11, fr: "Recevez-vous des prestations d'invalidité du RPC/RRQ ?", en: "Do you receive CPP/QPP disability benefits?", type: "BOOLEAN", required: false, showIf: "t5=true" },
  { id: "r12", section: "autres_revenus", order: 12, fr: "Recevez-vous le Supplément de revenu garanti (SRG) ou l'Allocation au survivant ?", en: "Do you receive the Guaranteed Income Supplement (GIS) or Allowance for the Survivor?", type: "BOOLEAN", required: false, showIf: "t5=true" },
  { id: "r13", section: "autres_revenus", order: 13, fr: "Avez-vous reçu des prestations d'assurance-emploi en 2025 ?", en: "Did you receive Employment Insurance benefits in 2025?", type: "BOOLEAN", required: false, showIf: "t5=true", documentRequired: "T4E" },
  { id: "r14", section: "autres_revenus", order: 14, fr: "Avez-vous reçu de l'aide sociale ou des prestations provinciales ?", en: "Did you receive social assistance or provincial benefits?", type: "BOOLEAN", required: false, showIf: "t5=true", documentRequired: "T5007" },
  { id: "r15", section: "autres_revenus", order: 15, fr: "Avez-vous reçu des indemnités d'accident du travail (ex. CNESST) ?", en: "Did you receive workers' compensation benefits (e.g. CNESST)?", type: "BOOLEAN", required: false, showIf: "t5=true" },
  { id: "r16", section: "autres_revenus", order: 16, fr: "Avez-vous reçu des prestations d'invalidité (assurance salaire privée ou publique) ?", en: "Did you receive disability insurance benefits (private or public)?", type: "BOOLEAN", required: false, showIf: "t5=true" },
  { id: "r17", section: "autres_revenus", order: 17, fr: "Avez-vous remboursé en 2025 des prestations reçues en trop (AE, SV, PCU/PCRE) ?", en: "Did you repay overpaid benefits in 2025 (EI, OAS, CERB/CRB)?", type: "MONEY", required: false, showIf: "t5=true", placeholder: "0,00 $" },
  { id: "r18", section: "autres_revenus", order: 18, fr: "Recevez-vous une pension alimentaire ?", en: "Do you receive support payments?", type: "MONEY", required: false, showIf: "t5=true", placeholder: "0,00 $", hint: "Montant et date de l'ordonnance (avant/après le 30 avril 1997)" },
  { id: "r19", section: "autres_revenus", order: 19, fr: "Avez-vous reçu des bourses d'études ou subventions de recherche ?", en: "Did you receive scholarships or research grants?", type: "MONEY", required: false, showIf: "t5=true", placeholder: "0,00 $", documentRequired: "T4A" },
  { id: "r20", section: "autres_revenus", order: 20, fr: "Avez-vous reçu des paiements d'un REEI ?", en: "Did you receive RDSP payments?", type: "BOOLEAN", required: false, showIf: "t5=true" },
  { id: "r21", section: "autres_revenus", order: 21, fr: "Avez-vous reçu des jetons de présence d'administrateur ou honoraires de juré ?", en: "Did you receive director's fees or jury fees?", type: "MONEY", required: false, showIf: "t5=true", placeholder: "0,00 $" },
  { id: "r22", section: "autres_revenus", order: 22, fr: "Avez-vous reçu des ristournes, subventions ou paiements gouvernementaux imposables ?", en: "Did you receive taxable patronage dividends, grants or government payments?", type: "MONEY", required: false, showIf: "t5=true", placeholder: "0,00 $" },
  { id: "r23", section: "autres_revenus", order: 23, fr: "Autres revenus non énumérés ci-dessus (précisez et montant)", en: "Other income not listed above (describe and amount)", type: "TEXT", required: false, showIf: "t5=true", placeholder: "Description et montant" },
];

// ─── MODULE DÉDUCTIONS (35 questions) ────────────────────────────────────────

export const MODULE_DEDUCTIONS: Question[] = [
  { id: "d1",  section: "deductions", order: 1,  fr: "Avez-vous cotisé à un REER cette année ?", en: "Did you contribute to an RRSP this year?", type: "BOOLEAN", required: true },
  { id: "d2",  section: "deductions", order: 2,  fr: "Cotisations REER en 2025 et durant les 60 premiers jours de 2026", en: "RRSP contributions in 2025 and first 60 days of 2026", type: "MONEY", required: false, showIf: "d1=true", placeholder: "0,00 $", documentRequired: "RRSP_RECEIPT" },
  { id: "d3",  section: "deductions", order: 3,  fr: "Droits de cotisation inutilisés au REER (avis de cotisation 2024)", en: "Unused RRSP contribution room (2024 notice of assessment)", type: "MONEY", required: false, showIf: "d1=true", placeholder: "0,00 $" },
  { id: "d4",  section: "deductions", order: 4,  fr: "Avez-vous cotisé au REER de votre époux/conjoint en 2025 ? (montant)", en: "Did you contribute to your spouse's RRSP in 2025? (amount)", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d5",  section: "deductions", order: 5,  fr: "Remboursement dans le cadre du RAP en 2025 (solde à rembourser)", en: "HBP repayment in 2025 (balance owing)", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d6",  section: "deductions", order: 6,  fr: "Remboursement dans le cadre du REEP en 2025 (solde à rembourser)", en: "LLP repayment in 2025 (balance owing)", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d7",  section: "deductions", order: 7,  fr: "Cotisations à un CELIAPP en 2025", en: "FHSA contributions in 2025", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d8",  section: "deductions", order: 8,  fr: "Cotisations à un RPA ou RPDB (montant au T4/RL-1)", en: "RPP or DPSP contributions (amount on T4/RL-1)", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d9",  section: "deductions", order: 9,  fr: "Cotisations syndicales ou professionnelles payées en 2025", en: "Union or professional dues paid in 2025", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d10", section: "deductions", order: 10, fr: "Avez-vous payé des frais de garde d'enfants en 2025 ?", en: "Did you pay child care expenses in 2025?", type: "BOOLEAN", required: true },
  { id: "d11", section: "deductions", order: 11, fr: "Frais de garde : par enfant et gardien — nom, NAS/NEQ, montants, semaines", en: "Child care: per child and caregiver — name, SIN/BN, amounts, weeks", type: "TEXT", required: false, showIf: "d10=true", documentRequired: "CHILDCARE_RECEIPT" },
  { id: "d12", section: "deductions", order: 12, fr: "Avez-vous eu des frais de déménagement en 2025 (au moins 40 km du travail/études) ?", en: "Did you have moving expenses in 2025 (at least 40 km closer to work/school)?", type: "BOOLEAN", required: false },
  { id: "d13", section: "deductions", order: 13, fr: "Payez-vous une pension alimentaire déductible ?", en: "Do you pay deductible support payments?", type: "MONEY", required: false, placeholder: "0,00 $", hint: "Montant annuel, bénéficiaire, date de l'ordonnance" },
  { id: "d14", section: "deductions", order: 14, fr: "Intérêts et frais d'emprunt payés pour gagner un revenu de placement ou d'entreprise", en: "Interest and borrowing costs paid to earn investment or business income", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d15", section: "deductions", order: 15, fr: "Votre employeur vous a-t-il signé un T2200 ? (dépenses : fournitures, bureau, véhicule)", en: "Did your employer sign a T2200? (expenses: supplies, home office, vehicle)", type: "BOOLEAN", required: false, showIf: "t1=true" },
  { id: "d16", section: "deductions", order: 16, fr: "Êtes-vous membre du clergé admissible à la déduction pour résidence ?", en: "Are you a clergy member eligible for the residence deduction?", type: "BOOLEAN", required: false },
  { id: "d17", section: "deductions", order: 17, fr: "Avez-vous droit à la déduction pour les habitants de régions éloignées (T2222) ?", en: "Are you entitled to the northern residents deduction (T2222)?", type: "BOOLEAN", required: false },
  { id: "d18", section: "deductions", order: 18, fr: "Déduction pour options d'achat d'actions", en: "Stock option deduction", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d19", section: "deductions", order: 19, fr: "Avez-vous des pertes d'entreprise, agricoles ou autres qu'en capital d'années antérieures à appliquer ?", en: "Do you have business, farm or non-capital losses from prior years to apply?", type: "BOOLEAN", required: false },
  { id: "d20", section: "deductions", order: 20, fr: "Remboursement de prestations d'AE ou de SV inclus dans le revenu", en: "Repayment of EI or OAS benefits included in income", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d21", section: "deductions", order: 21, fr: "Avez-vous des frais de scolarité à déclarer ?", en: "Do you have tuition fees to claim?", type: "BOOLEAN", required: true },
  { id: "d22", section: "deductions", order: 22, fr: "Frais de scolarité payés en 2025 (T2202) : montant, établissement", en: "Tuition paid in 2025 (T2202): amount, institution", type: "MONEY", required: false, showIf: "d21=true", placeholder: "0,00 $", documentRequired: "T2202" },
  { id: "d23", section: "deductions", order: 23, fr: "Montants inutilisés de frais de scolarité d'années antérieures", en: "Unused tuition amounts from prior years", type: "MONEY", required: false, showIf: "d21=true", placeholder: "0,00 $" },
  { id: "d24", section: "deductions", order: 24, fr: "Transférez-vous des frais de scolarité à un parent, ou recevez-vous un transfert d'un enfant ?", en: "Are you transferring tuition to a parent, or receiving a transfer from a child?", type: "BOOLEAN", required: false, showIf: "d21=true" },
  { id: "d25", section: "deductions", order: 25, fr: "Intérêts payés en 2025 sur un prêt étudiant", en: "Interest paid in 2025 on a student loan", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d26", section: "deductions", order: 26, fr: "Avez-vous des frais médicaux à déclarer ?", en: "Do you have medical expenses to claim?", type: "BOOLEAN", required: true },
  { id: "d27", section: "deductions", order: 27, fr: "Frais médicaux 2025 pour vous, conjoint et enfants (ordonnances, dentaire, lunettes, primes d'assurance)", en: "2025 medical expenses for you, spouse and children (prescriptions, dental, glasses, insurance premiums)", type: "TEXT", required: false, showIf: "d26=true", documentRequired: "MEDICAL_RECEIPTS" },
  { id: "d28", section: "deductions", order: 28, fr: "Avez-vous fait des dons de bienfaisance ?", en: "Did you make any charitable donations?", type: "BOOLEAN", required: true },
  { id: "d29", section: "deductions", order: 29, fr: "Dons de bienfaisance et dons politiques fédéraux 2025 (reçus, montants, reports 5 ans)", en: "2025 charitable and federal political donations (receipts, amounts, 5-year carryforwards)", type: "TEXT", required: false, showIf: "d28=true", documentRequired: "DONATION_RECEIPT" },
  { id: "d30", section: "deductions", order: 30, fr: "Cotisation au RPC/RRQ à payer sur un revenu de travail autonome", en: "CPP/QPP contributions payable on self-employment income", type: "MONEY", required: false, showIf: "t2=true", placeholder: "0,00 $" },
  { id: "d31", section: "deductions", order: 31, fr: "Êtes-vous inscrit volontairement à l'assurance-emploi pour travailleurs autonomes ?", en: "Are you voluntarily registered for EI as a self-employed worker?", type: "BOOLEAN", required: false, showIf: "t2=true" },
  { id: "d32", section: "deductions", order: 32, fr: "Cotisation au RQAP à payer sur un revenu de travail autonome ou hors Québec", en: "QPIP premiums payable on self-employment or out-of-Québec income", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "d33", section: "deductions", order: 33, fr: "Impôt minimum de remplacement fédéral (T691) : importantes déductions demandées ?", en: "Federal alternative minimum tax (T691): large deductions claimed?", type: "BOOLEAN", required: false },
  { id: "d34", section: "deductions", order: 34, fr: "Remboursement de la pension de la SV (récupération si revenu net dépasse le seuil) ?", en: "OAS recovery tax (clawback if net income exceeds threshold)?", type: "BOOLEAN", required: false },
  { id: "d35", section: "deductions", order: 35, fr: "Retenues d'impôt insuffisantes — impôt fédéral et provincial retenus à la source (T4/RL-1)", en: "Insufficient withholdings — federal and provincial tax withheld at source (T4/RL-1)", type: "MONEY", required: false, placeholder: "0,00 $" },
];

// ─── MODULE CRÉDITS (21 questions) ───────────────────────────────────────────

export const MODULE_CREDITS: Question[] = [
  { id: "c1",  section: "credits", order: 1,  fr: "Aviez-vous 65 ans ou plus au 31 décembre 2025 ?", en: "Were you 65 or older on December 31, 2025?", type: "BOOLEAN", required: false },
  { id: "c2",  section: "credits", order: 2,  fr: "Votre époux/conjoint a-t-il un revenu net inférieur au montant personnel de base ?", en: "Does your spouse have net income below the basic personal amount?", type: "BOOLEAN", required: false, showIf: "t6=true" },
  { id: "c3",  section: "credits", order: 3,  fr: "Subvenez-vous aux besoins d'une personne à charge admissible vivant avec vous ?", en: "Do you support an eligible dependant living with you?", type: "BOOLEAN", required: false },
  { id: "c4",  section: "credits", order: 4,  fr: "Prenez-vous soin d'une personne à charge de 18 ans ou plus atteinte d'une déficience ?", en: "Do you care for a dependant 18 or older with an impairment?", type: "BOOLEAN", required: false },
  { id: "c5",  section: "credits", order: 5,  fr: "Êtes-vous admissible au crédit d'impôt pour personnes handicapées (CIPH, T2201 approuvé) ?", en: "Are you eligible for the disability tax credit (DTC, approved T2201)?", type: "BOOLEAN", required: false, documentRequired: "T2201" },
  { id: "c6",  section: "credits", order: 6,  fr: "Une personne à charge admissible au CIPH transfère-t-elle une partie inutilisée de son crédit ?", en: "Does a DTC-eligible dependant transfer unused credit to you?", type: "BOOLEAN", required: false },
  { id: "c7",  section: "credits", order: 7,  fr: "Montant canadien pour emploi (si revenu d'emploi en 2025)", en: "Canada employment amount (if employment income in 2025)", type: "BOOLEAN", required: false, showIf: "t1=true" },
  { id: "c8",  section: "credits", order: 8,  fr: "Avez-vous reçu un revenu de pension admissible ? (jusqu'à 2 000 $)", en: "Did you receive eligible pension income? (up to $2,000)", type: "BOOLEAN", required: false },
  { id: "c9",  section: "credits", order: 9,  fr: "Êtes-vous pompier volontaire ou volontaire en recherche et sauvetage (200 h ou plus) ?", en: "Are you a volunteer firefighter or search and rescue volunteer (200+ hours)?", type: "BOOLEAN", required: false },
  { id: "c10", section: "credits", order: 10, fr: "Avez-vous acheté une première habitation admissible en 2025 ?", en: "Did you buy a qualifying first home in 2025?", type: "BOOLEAN", required: false },
  { id: "c11", section: "credits", order: 11, fr: "Avez-vous engagé des dépenses pour l'accessibilité domiciliaire ?", en: "Did you incur home accessibility expenses?", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "c12", section: "credits", order: 12, fr: "Avez-vous payé des frais d'adoption en 2025 ?", en: "Did you pay adoption expenses in 2025?", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "c13", section: "credits", order: 13, fr: "Votre époux/conjoint vous transfère-t-il des crédits inutilisés (annexe 2) ?", en: "Is your spouse transferring unused credits to you? (Schedule 2)", type: "BOOLEAN", required: false, showIf: "t6=true" },
  { id: "c14", section: "credits", order: 14, fr: "Avez-vous accumulé des droits au crédit canadien pour la formation ?", en: "Have you accumulated Canada training credit rights?", type: "BOOLEAN", required: false },
  { id: "c15", section: "credits", order: 15, fr: "Cotisations employé au RPC/RRQ, AE et RQAP (cases des T4)", en: "Employee CPP/QPP, EI and QPIP contributions (T4 boxes)", type: "MONEY", required: false, placeholder: "0,00 $" },
  { id: "c16", section: "credits", order: 16, fr: "Enfants à charge de moins de 18 ans au 31 décembre (ACE) — garde partagée ?", en: "Dependent children under 18 on Dec 31 (CCB) — shared custody?", type: "BOOLEAN", required: false, showIf: "t6=true" },
  { id: "c17", section: "credits", order: 17, fr: "Demandez-vous l'Allocation canadienne pour les travailleurs (ACT) ?", en: "Are you claiming the Canada Workers Benefit (CWB)?", type: "BOOLEAN", required: false },
  { id: "c18", section: "credits", order: 18, fr: "Avez-vous demandé la Prestation canadienne pour les personnes handicapées ?", en: "Did you apply for the Canada Disability Benefit?", type: "BOOLEAN", required: false },
  { id: "c19", section: "credits", order: 19, fr: "Crédit pour la TPS/TVH : confirmez votre état civil et vos enfants", en: "GST/HST credit: confirm your marital status and children", type: "BOOLEAN", required: false },
  { id: "c20", section: "credits", order: 20, fr: "Crédits remboursables d'autres provinces/territoires (OTB ontarien, crédit TV de la C.-B., etc.)", en: "Refundable credits of other provinces/territories", type: "MULTI_CHOICE", required: false,
    options: [
      { value: "on_trillium", fr: "Prestation Trillium (Ontario)", en: "Ontario Trillium Benefit" },
      { value: "bc_sales",    fr: "Crédit de taxe de vente BC",   en: "BC Sales Tax Credit"      },
      { value: "ab_credit",   fr: "Crédit supplémentaire Alberta", en: "Alberta Supplemental"    },
      { value: "other",       fr: "Autre province/territoire",    en: "Other province/territory" },
    ],
  },
  { id: "c21", section: "credits", order: 21, fr: "Avez-vous un solde d'impôt à recevoir ou à payer selon votre avis de cotisation 2024 ?", en: "Do you have a balance owing or refund per your 2024 notice of assessment?", type: "MONEY", required: false, placeholder: "0,00 $ (négatif = remboursement)" },
];

// ─── MODULE QUÉBEC (37 questions — résumé, les principales) ──────────────────

export const MODULE_QUEBEC: Question[] = [
  { id: "q1",  section: "ma_province", order: 1,  fr: "Province de résidence au 31 décembre 2025", en: "Province of residence on December 31, 2025", type: "SINGLE_CHOICE", required: true,
    options: [
      { value: "AB", fr: "Alberta", en: "Alberta" }, { value: "BC", fr: "Colombie-Britannique", en: "British Columbia" },
      { value: "MB", fr: "Manitoba", en: "Manitoba" }, { value: "NB", fr: "Nouveau-Brunswick", en: "New Brunswick" },
      { value: "NL", fr: "Terre-Neuve-et-Labrador", en: "Newfoundland and Labrador" }, { value: "NS", fr: "Nouvelle-Écosse", en: "Nova Scotia" },
      { value: "NT", fr: "Territoires du Nord-Ouest", en: "Northwest Territories" }, { value: "NU", fr: "Nunavut", en: "Nunavut" },
      { value: "ON", fr: "Ontario", en: "Ontario" }, { value: "PE", fr: "Île-du-Prince-Édouard", en: "Prince Edward Island" },
      { value: "QC", fr: "Québec", en: "Quebec" }, { value: "SK", fr: "Saskatchewan", en: "Saskatchewan" },
      { value: "YT", fr: "Yukon", en: "Yukon" },
    ] },
  { id: "q2",  section: "ma_province", order: 2,  fr: "Avez-vous versé des contributions politiques provinciales en 2025 ?", en: "Did you make provincial political contributions in 2025?", type: "BOOLEAN", required: false,
    provinceOnly: ["QC"]
  },
  { id: "q3",  section: "ma_province", order: 3,  fr: "Cotisation au RRQ : salarié (feuillets) ou travailleur autonome ?", en: "QPP contributions: employee (slips) or self-employed?", type: "SINGLE_CHOICE", required: false,
    options: [{ value: "employee", fr: "Salarié (RL-1)", en: "Employee (RL-1)" }, { value: "self", fr: "Travailleur autonome (annexe U)", en: "Self-employed (Schedule U)" }],
    provinceOnly: ["QC"]
  },
  { id: "q4",  section: "ma_province", order: 4,  fr: "Avez-vous choisi de cesser de cotiser au RRQ (60 à 70 ans, CPT30) ?", en: "Did you elect to stop contributing to the QPP (ages 60-70, CPT30)?", type: "BOOLEAN", required: false,
    provinceOnly: ["QC"]
  },
  { id: "q5",  section: "ma_province", order: 5,  fr: "Cotisation au RQAP : salarié (RL-1) ou travailleur autonome/hors Québec ?", en: "QPIP premiums: employee (RL-1) or self-employed/outside Québec?", type: "SINGLE_CHOICE", required: false,
    options: [{ value: "employee", fr: "Salarié (RL-1)", en: "Employee (RL-1)" }, { value: "self", fr: "Travailleur autonome", en: "Self-employed" }],
    provinceOnly: ["QC"]
  },
  { id: "q6",  section: "ma_province", order: 6,  fr: "Assurance médicaments du Québec : couvert TOUTE l'année par une assurance privée ?", en: "Québec drug insurance: covered ALL year by private insurance?", type: "BOOLEAN", required: false,
    provinceOnly: ["QC"]
  },
  { id: "q7",  section: "ma_province", order: 7,  fr: "Avez-vous payé une prime à l'assurance médicaments du Québec en 2025 ?", en: "Did you pay a Québec drug insurance premium in 2025?", type: "MONEY", required: false, placeholder: "0,00 $",
    provinceOnly: ["QC"]
  },
  { id: "q8",  section: "ma_province", order: 8,  fr: "Contribution santé 2025 (revenu net entre 18 130 $ et 150 000 $)", en: "Health contribution 2025 (net income between $18,130 and $150,000)", type: "MONEY", required: false, placeholder: "0,00 $",
    provinceOnly: ["QC"]
  },
  { id: "q9",  section: "ma_province", order: 9,  fr: "Avez-vous payé un loyer au Québec en 2025 ?", en: "Did you pay rent in Québec in 2025?", type: "MONEY", required: false, placeholder: "0,00 $ (montant annuel)", hint: "Pour le crédit de solidarité",
    provinceOnly: ["QC"]
  },
  { id: "q10", section: "ma_province", order: 10, fr: "Avez-vous payé des taxes foncières au Québec en 2025 ?", en: "Did you pay property taxes in Québec in 2025?", type: "MONEY", required: false, placeholder: "0,00 $", hint: "Pour le crédit de solidarité",
    provinceOnly: ["QC"]
  },
  { id: "q11", section: "ma_province", order: 11, fr: "Avez-vous demandé le crédit pour maintien à domicile (personne de 70 ans ou plus) ?", en: "Are you claiming the home support credit (70 years or older)?", type: "BOOLEAN", required: false,
    provinceOnly: ["QC"]
  },
  { id: "q12", section: "ma_province", order: 12, fr: "Avez-vous des actions admissibles du Fonds de solidarité FTQ ou Fondaction ?", en: "Do you have eligible shares in the FTQ Solidarity Fund or Fondaction?", type: "MONEY", required: false, placeholder: "0,00 $",
    provinceOnly: ["QC"]
  },
  { id: "q13", section: "ma_province", order: 13, fr: "Avez-vous fait des dons à des organismes culturels ou de bienfaisance (reçus TP-726.8.1) ?", en: "Did you make donations to cultural or charitable organizations (TP-726.8.1)?", type: "BOOLEAN", required: false,
    provinceOnly: ["QC"]
  },
  { id: "q14", section: "ma_province", order: 14, fr: "Avez-vous engagé des frais pour rénovation écoresponsable (RénoVert ou LogisVert) ?", en: "Did you incur eco-responsible renovation expenses (RénoVert or LogisVert)?", type: "MONEY", required: false, placeholder: "0,00 $",
    provinceOnly: ["QC"]
  },
  { id: "q15", section: "ma_province", order: 15, fr: "Frais de scolarité québécois (relevé 8) non encore demandés", en: "Québec tuition fees (relevé 8) not yet claimed", type: "MONEY", required: false, placeholder: "0,00 $",
    provinceOnly: ["QC"]
  },
  { id: "q16", section: "ma_province", order: 16, fr: "Crédit pour les travailleurs d'expérience (55 ans ou plus, revenu de travail)", en: "Credit for experienced workers (55 years or older, work income)", type: "BOOLEAN", required: false,
    provinceOnly: ["QC"]
  },
  { id: "q17", section: "ma_province", order: 17, fr: "Remboursement de l'impôt des particuliers du Québec retenu à la source", en: "Québec personal income tax withheld at source", type: "MONEY", required: false, placeholder: "0,00 $",
    provinceOnly: ["QC"]
  },
];

// ─── MODULE DOCUMENTS (7 questions) ─────────────────────────────────────────
// Type DOCUMENT = bloc upload avec support multi-feuillets

export const MODULE_DOCUMENTS: Question[] = [
  { id: "doc1", section: "documents", order: 1, fr: "T4 — Rémunération d'un employeur", en: "T4 — Employment income slip", type: "DOCUMENT", required: false, showIf: "t1=true", documentRequired: "T4", hint: "Ajoutez un bloc par employeur (T4 #1, T4 #2...)" },
  { id: "doc2", section: "documents", order: 2, fr: "Relevé 1 (RL-1) — Revenus d'emploi (Québec)", en: "RL-1 — Employment income (Québec)", type: "DOCUMENT", required: false, showIf: "t1=true", documentRequired: "RL-1", hint: "Un RL-1 par employeur" },
  { id: "doc3", section: "documents", order: 3, fr: "T5 — Relevé de revenus de placements", en: "T5 — Investment income slip", type: "DOCUMENT", required: false, showIf: "t4=true", documentRequired: "T5", hint: "Un T5 par institution financière" },
  { id: "doc4", section: "documents", order: 4, fr: "T4A — Autres revenus (pension, bourses, case 048...)", en: "T4A — Other income (pension, scholarships, box 048...)", type: "DOCUMENT", required: false, documentRequired: "T4A", hint: "Pension, bourses, allocations de retraite" },
  { id: "doc5", section: "documents", order: 5, fr: "T4E — Prestations d'assurance-emploi", en: "T4E — Employment Insurance benefits", type: "DOCUMENT", required: false, showIf: "r13=true", documentRequired: "T4E" },
  { id: "doc6", section: "documents", order: 6, fr: "Reçus de cotisation REER", en: "RRSP contribution receipts", type: "DOCUMENT", required: false, showIf: "d1=true", documentRequired: "RRSP_RECEIPT", hint: "Reçus de votre institution financière" },
  { id: "doc7", section: "documents", order: 7, fr: "Autres documents fiscaux", en: "Other tax documents", type: "DOCUMENT", required: false, hint: "T3, T5013, RL-2, T2202, reçus médicaux, dons, etc." },
];

// ─── MODULE RÉVISION (13 questions) ──────────────────────────────────────────

export const MODULE_REVISION: Question[] = [
  { id: "rev1",  section: "revision", order: 1,  fr: "Avez-vous des dettes fiscales impayées auprès de l'ARC ou de Revenu Québec ?", en: "Do you have unpaid tax debts with CRA or Revenu Québec?", type: "BOOLEAN", required: false },
  { id: "rev2",  section: "revision", order: 2,  fr: "Souhaitez-vous souscrire au dépôt direct pour recevoir votre remboursement ?", en: "Do you want to sign up for direct deposit to receive your refund?", type: "BOOLEAN", required: false },
  { id: "rev3",  section: "revision", order: 3,  fr: "Numéro de compte bancaire pour dépôt direct (institution, transit, compte)", en: "Bank account number for direct deposit (institution, transit, account)", type: "TEXT", required: false, showIf: "rev2=true" },
  { id: "rev4",  section: "revision", order: 4,  fr: "Souhaitez-vous verser une somme à un REER, CELIAPP ou CELI ?", en: "Do you want to contribute to an RRSP, FHSA or TFSA?", type: "BOOLEAN", required: false },
  { id: "rev5",  section: "revision", order: 5,  fr: "Avez-vous reçu un avis de cotisation ou une demande de renseignements de l'ARC en 2025 ?", en: "Did you receive a notice of assessment or information request from CRA in 2025?", type: "BOOLEAN", required: false },
  { id: "rev6",  section: "revision", order: 6,  fr: "Avez-vous été cotisé en trop les années précédentes (droits à un remboursement non réclamé) ?", en: "Were you over-assessed in prior years (unclaimed refund rights)?", type: "BOOLEAN", required: false },
  { id: "rev7",  section: "revision", order: 7,  fr: "Désirez-vous que votre préparateur reçoive votre avis de cotisation ?", en: "Do you want your preparer to receive your notice of assessment?", type: "BOOLEAN", required: false },
  { id: "rev8",  section: "revision", order: 8,  fr: "Autorisez-vous votre préparateur à discuter de votre dossier avec l'ARC ?", en: "Do you authorize your preparer to discuss your file with CRA?", type: "BOOLEAN", required: false },
  { id: "rev9",  section: "revision", order: 9,  fr: "Autorisez-vous votre préparateur à discuter de votre dossier avec Revenu Québec ?", en: "Do you authorize your preparer to discuss your file with Revenu Québec?", type: "BOOLEAN", required: false },
  { id: "rev10", section: "revision", order: 10, fr: "Avez-vous des commentaires ou des situations particulières à signaler à votre préparateur ?", en: "Do you have comments or special situations to report to your preparer?", type: "TEXT", required: false, placeholder: "Décrivez toute situation particulière..." },
  { id: "rev11", section: "revision", order: 11, fr: "Confirmez-vous que toutes les informations fournies sont complètes et exactes à votre connaissance ?", en: "Do you confirm that all information provided is complete and accurate to the best of your knowledge?", type: "BOOLEAN", required: true },
  { id: "rev12", section: "revision", order: 12, fr: "Signature électronique", en: "Electronic signature", type: "TEXT", required: true, placeholder: "Entrez votre nom complet pour signer" },
  { id: "rev13", section: "revision", order: 13, fr: "Date de signature", en: "Signature date", type: "DATE", required: true },
];

// ─── EXPORT CONSOLIDÉ ────────────────────────────────────────────────────────

export const ALL_INDIVIDUAL_QUESTIONS: Question[] = [
  ...TRIAGE,
  ...MODULE_PROFIL,
  ...MODULE_FAMILLE,
  ...MODULE_EMPLOI,
  ...MODULE_AUTONOME,
  ...MODULE_LOCATION,
  ...MODULE_PLACEMENTS,
  ...MODULE_AUTRES_REVENUS,
  ...MODULE_DEDUCTIONS,
  ...MODULE_CREDITS,
  ...MODULE_QUEBEC,
  ...MODULE_DOCUMENTS,
  ...MODULE_REVISION,
];

export const INDIVIDUAL_SECTIONS = [
  // WORKFLOW: Triage → Documents (OCR) → Profil (valide OCR) → Famille → Emploi...
  { code: "triage",          fr: "Triage",            en: "Triage",        icon: "🧭", alwaysShow: true  },
  { code: "documents",       fr: "Documents",         en: "Documents",     icon: "📎", alwaysShow: true  }, // ← position 2: upload+OCR avant tout
  { code: "profil",          fr: "Profil",            en: "Profile",       icon: "🪪", alwaysShow: true  }, // ← position 3: valide données OCR
  { code: "famille",         fr: "Famille",           en: "Family",        icon: "👨‍👩‍👧", showIf: "t6=true" },
  { code: "emploi",          fr: "Emploi",            en: "Employment",    icon: "💼", showIf: "t1=true" },
  { code: "autonome",        fr: "Travail autonome",  en: "Self-employed", icon: "🧑‍💼", showIf: "t2=true" },
  { code: "location",        fr: "Location",          en: "Rental",        icon: "🏠", showIf: "t3=true" },
  { code: "placements",      fr: "Placements",        en: "Investments",   icon: "📈", showIf: "t4=true" },
  { code: "autres_revenus",  fr: "Autres revenus",    en: "Other income",  icon: "💰", showIf: "t5=true" },
  { code: "deductions",      fr: "Déductions",        en: "Deductions",    icon: "📉", alwaysShow: true  },
  { code: "credits",         fr: "Crédits",           en: "Credits",       icon: "🎁", alwaysShow: true  },
  { code: "ma_province",     fr: "Ma province",       en: "My province",   icon: "🏛️", alwaysShow: true  },
  { code: "revision",        fr: "Révision",          en: "Review",        icon: "📋", alwaysShow: true  },
];


// ─── ALL QUESTIONS (avec module provincial) ──────────────────────────────────
// Utiliser cette fonction quand MODULE_MA_PROVINCE doit être inclus
export function getAllQuestionsWithProvince(): Question[] {
  return [...ALL_INDIVIDUAL_QUESTIONS, ...MODULE_MA_PROVINCE];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE MA PROVINCE — 52 questions conditionnelles par province
// Source: Banque_de_questions_conditionnelles_par_province_2025.html
// Chaque question porte provinceOnly: ["XX"] pour filtrage dynamique
// La section "Québec" (37 questions) est conservée avec provinceOnly: ["QC"]
// ═══════════════════════════════════════════════════════════════════════════════

export const MODULE_MA_PROVINCE: Question[] = [

  // ── ONTARIO (8 questions) ────────────────────────────────────────────────
  {
    id: "ON-01", section: "ma_province", order: 301,
    fr: "Avez-vous payé un loyer pour votre résidence principale en Ontario en 2025 ? Si oui, quel montant total ?",
    en: "Did you pay rent for your principal residence in Ontario in 2025? If so, what total amount?",
    type: "MONEY", required: false,
    hint: "Requis pour la Prestation Trillium (OEPTC) — composante logement.",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-02", section: "ma_province", order: 302,
    fr: "Avez-vous payé des impôts fonciers pour votre résidence principale en Ontario en 2025 ? Si oui, quel montant ?",
    en: "Did you pay property tax for your principal residence in Ontario in 2025? If so, what amount?",
    type: "MONEY", required: false,
    hint: "Requis pour l'OEPTC (formulaire ON-BEN).",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-03", section: "ma_province", order: 303,
    fr: "Votre résidence principale était-elle située dans le Nord de l'Ontario (p. ex. Sudbury, Thunder Bay, Timmins, North Bay, Sault Ste. Marie) ?",
    en: "Was your principal residence located in Northern Ontario?",
    type: "BOOLEAN", required: false,
    hint: "NOEC — Northern Ontario Energy Credit (max 285 $ / 25 $ si Nord).",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-04", section: "ma_province", order: 304,
    fr: "Avez-vous payé des frais d'énergie sur une réserve, des frais d'hébergement en foyer de soins de longue durée public, ou vécu en résidence étudiante désignée ?",
    en: "Did you pay energy costs on a reserve, public long-term care home fees, or live in a designated student residence?",
    type: "BOOLEAN", required: false,
    provinceOnly: ["ON"],
  },
  {
    id: "ON-05", section: "ma_province", order: 305,
    fr: "Avez-vous payé des frais de garde d'enfants en 2025 (garderie, camp de jour) ? Quel montant ?",
    en: "Did you pay child care expenses in 2025 (daycare, day camp)? What amount?",
    type: "MONEY", required: false,
    hint: "CARE — Child Care Access and Relief from Expenses (jusqu'à 6 000 $ / enfant de moins de 7 ans).",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-06", section: "ma_province", order: 306,
    fr: "Aviez-vous 70 ans ou plus et avez-vous engagé des frais médicaux pour des soins à domicile en 2025 ? Quel montant ?",
    en: "Were you 70 or older and did you incur medical expenses for home care in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit soins à domicile ON : 25 %, max 1 500 $ / ménage.",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-07", section: "ma_province", order: 307,
    fr: "Avez-vous versé des contributions à un parti politique provincial ou à un candidat ontarien en 2025 ? Quel montant ?",
    en: "Did you make contributions to an Ontario provincial political party or candidate in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques ON — max 650 $.",
    provinceOnly: ["ON"],
  },
  {
    id: "ON-08", section: "ma_province", order: 308,
    fr: "Aviez-vous 64 ans ou plus et étiez-vous propriétaire occupant de votre résidence en 2025 ?",
    en: "Were you 64 or older and an occupying homeowner in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Subvention aînés propriétaires ON — 500 $.",
    provinceOnly: ["ON"],
  },

  // ── COLOMBIE-BRITANNIQUE (5 questions) ──────────────────────────────────
  {
    id: "BC-01", section: "ma_province", order: 311,
    fr: "Étiez-vous locataire de votre résidence principale en Colombie-Britannique en 2025 ?",
    en: "Were you a renter of your principal residence in British Columbia in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Crédit locataires remboursable C.-B. — max 400 $. Le montant ne dépend pas du loyer.",
    provinceOnly: ["BC"],
  },
  {
    id: "BC-02", section: "ma_province", order: 312,
    fr: "Avez-vous suivi une formation professionnelle admissible en C.-B. en 2025 ?",
    en: "Did you take eligible vocational training in B.C. in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Crédit formation des particuliers BC — dernier appel 31 déc. 2025.",
    provinceOnly: ["BC"],
  },
  {
    id: "BC-03", section: "ma_province", order: 313,
    fr: "Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage en C.-B. en 2025 (200 heures ou plus) ?",
    en: "Were you a volunteer firefighter or search and rescue volunteer in B.C. in 2025 (200+ hours)?",
    type: "BOOLEAN", required: false,
    hint: "Montant 3 000 $.",
    provinceOnly: ["BC"],
  },
  {
    id: "BC-04", section: "ma_province", order: 314,
    fr: "Avez-vous versé des contributions à un parti politique provincial ou à un candidat en C.-B. en 2025 ? Quel montant ?",
    en: "Did you make contributions to a B.C. provincial political party or candidate in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques BC — max 500 $.",
    provinceOnly: ["BC"],
  },
  {
    id: "BC-05", section: "ma_province", order: 315,
    fr: "Étiez-vous parent seul (monoparental) en 2025 ?",
    en: "Were you a single parent in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Supplément monoparental BC Family Benefit — jusqu'à 500 $ / an.",
    provinceOnly: ["BC"],
  },

  // ── ALBERTA (2 questions) ────────────────────────────────────────────────
  {
    id: "AB-01", section: "ma_province", order: 321,
    fr: "Avez-vous versé des contributions à un parti politique provincial, à un candidat ou à une association de candidat potentiel en Alberta en 2025 ? Quel montant ?",
    en: "Did you make contributions to an Alberta provincial political party, candidate, or prospective candidate association in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques AB — max 1 000 $ (dons à une association de candidat potentiel admissibles depuis le 4 juillet 2025).",
    provinceOnly: ["AB"],
  },
  {
    id: "AB-02", section: "ma_province", order: 322,
    fr: "Avez-vous fait des dons de bienfaisance en 2025 ? Quel montant ?",
    en: "Did you make charitable donations in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Taux albertain unique : 60 % sur les premiers 200 $, 21 % au-delà — le plus généreux au Canada sous 200 $.",
    provinceOnly: ["AB"],
  },

  // ── SASKATCHEWAN (5 questions) ───────────────────────────────────────────
  {
    id: "SK-01", section: "ma_province", order: 331,
    fr: "Êtes-vous diplômé d'un établissement postsecondaire de la Saskatchewan ? Si oui, année d'obtention et type de diplôme ?",
    en: "Did you graduate from a Saskatchewan post-secondary institution? If so, year and type of degree/diploma?",
    type: "TEXT", required: false,
    hint: "Graduate Retention Program — jusqu'à 24 000 $ pour un baccalauréat de 4 ans obtenu après le 1er oct. 2024, versé sur 7 ans.",
    provinceOnly: ["SK"],
  },
  {
    id: "SK-02", section: "ma_province", order: 332,
    fr: "Avez-vous acheté une première habitation en Saskatchewan depuis le 1er octobre 2024 ?",
    en: "Did you purchase a first home in Saskatchewan since October 1, 2024?",
    type: "BOOLEAN", required: false,
    hint: "Crédit premier acheteur bonifié SK — 15 000 $, max 1 575 $ de crédit.",
    provinceOnly: ["SK"],
  },
  {
    id: "SK-03", section: "ma_province", order: 333,
    fr: "Avez-vous engagé des dépenses de rénovation domiciliaire en 2025 ? Quel montant ?",
    en: "Did you incur home renovation expenses in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit rénovation SK — max 420 $ (525 $ pour aînés).",
    provinceOnly: ["SK"],
  },
  {
    id: "SK-04", section: "ma_province", order: 334,
    fr: "Vos enfants étaient-ils inscrits à des activités sportives, culturelles ou récréatives en 2025 ? Quel montant par enfant ?",
    en: "Were your children enrolled in sports, cultural or recreational activities in 2025? What amount per child?",
    type: "MONEY", required: false,
    hint: "Active Families Benefit remboursable — 300 $ / enfant (400 $ si CIPH), seuil familial 120 000 $.",
    provinceOnly: ["SK"],
  },
  {
    id: "SK-05", section: "ma_province", order: 335,
    fr: "Avez-vous engagé des dépenses de traitement de fertilité en 2025 ? Quel montant ? (Une seule demande à vie.)",
    en: "Did you incur fertility treatment expenses in 2025? What amount? (One lifetime claim.)",
    type: "MONEY", required: false,
    hint: "Nouveau crédit fertilité remboursable SK 2025 — 50 % des frais, max 10 000 $ de frais.",
    provinceOnly: ["SK"],
  },

  // ── MANITOBA (5 questions) ────────────────────────────────────────────────
  {
    id: "MB-01", section: "ma_province", order: 341,
    fr: "Étiez-vous locataire au Manitoba en 2025 ?",
    en: "Were you a renter in Manitoba in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Renters Tax Credit remboursable MB — max 575 $ (+328 $ pour aîné).",
    provinceOnly: ["MB"],
  },
  {
    id: "MB-02", section: "ma_province", order: 342,
    fr: "Étiez-vous propriétaire occupant de votre résidence principale au Manitoba en 2025 ?",
    en: "Were you an occupying homeowner of your principal residence in Manitoba in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Homeowners Affordability Tax Credit MB — jusqu'à 1 500 $.",
    provinceOnly: ["MB"],
  },
  {
    id: "MB-03", section: "ma_province", order: 343,
    fr: "Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage au Manitoba en 2025 ?",
    en: "Were you a volunteer firefighter or search and rescue volunteer in Manitoba in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Montant doublé à 6 000 $ en 2025 — crédit max 648 $.",
    provinceOnly: ["MB"],
  },
  {
    id: "MB-04", section: "ma_province", order: 344,
    fr: "Avez-vous engagé des dépenses de traitement de fertilité en 2025 ? Quel montant ?",
    en: "Did you incur fertility treatment expenses in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit fertilité MB — dépenses max 40 000 $, crédit max 16 000 $ / an.",
    provinceOnly: ["MB"],
  },
  {
    id: "MB-05", section: "ma_province", order: 345,
    fr: "Précisez vos personnes à charge : conjoint, 65 ans+, invalidité, enfants de 18 ans ou moins (nombre) ?",
    en: "Please detail your dependants: spouse, 65+, disability, children 18 or under (how many)?",
    type: "MULTI_CHOICE", required: false,
    hint: "Manitoba Family Tax Benefit — somme de montants × 10,8 %.",
    options: [
      { value: "conjoint",     fr: "Conjoint(e)",             en: "Spouse"                   },
      { value: "aines",        fr: "Personne de 65 ans et +", en: "Person 65 or older"        },
      { value: "invalidite",   fr: "Personne handicapée",      en: "Person with disability"   },
      { value: "enfants",      fr: "Enfant(s) de 18 ans et -", en: "Children 18 or under"    },
    ],
    provinceOnly: ["MB"],
  },

  // ── NOUVEAU-BRUNSWICK (3 questions) ─────────────────────────────────────
  {
    id: "NB-01", section: "ma_province", order: 351,
    fr: "Avez-vous versé des contributions à un parti politique provincial ou à un candidat au Nouveau-Brunswick en 2025 ? Quel montant ?",
    en: "Did you make contributions to a New Brunswick provincial political party or candidate in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques NB — max 500 $.",
    provinceOnly: ["NB"],
  },
  {
    id: "NB-02", section: "ma_province", order: 352,
    fr: "Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage au Nouveau-Brunswick en 2025 ?",
    en: "Were you a volunteer firefighter or search and rescue volunteer in New Brunswick in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Crédit pompier volontaire / R&S NB — depuis le 1er janv. 2024.",
    provinceOnly: ["NB"],
  },
  {
    id: "NB-03", section: "ma_province", order: 353,
    fr: "Avez-vous investi dans une petite entreprise du Nouveau-Brunswick en 2025 ? Quel montant ?",
    en: "Did you invest in a New Brunswick small business in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit d'impôt pour les investisseurs dans les petites entreprises du N.-B.",
    provinceOnly: ["NB"],
  },

  // ── NOUVELLE-ÉCOSSE (2 questions) ────────────────────────────────────────
  {
    id: "NS-01", section: "ma_province", order: 361,
    fr: "Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage en Nouvelle-Écosse en 2025 ?",
    en: "Were you a volunteer firefighter or search and rescue volunteer in Nova Scotia in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Montant pompier volontaire / R&S NS — 3 000 $ au taux de 8,79 %.",
    provinceOnly: ["NS"],
  },
  {
    id: "NS-02", section: "ma_province", order: 362,
    fr: "Avez-vous versé des contributions à un parti politique provincial ou à un candidat en Nouvelle-Écosse en 2025 ? Quel montant ?",
    en: "Did you make contributions to a Nova Scotia provincial political party or candidate in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques NS.",
    provinceOnly: ["NS"],
  },

  // ── ÎLE-DU-PRINCE-ÉDOUARD (4 questions) ─────────────────────────────────
  {
    id: "PE-01", section: "ma_province", order: 371,
    fr: "Avez-vous payé des dépenses pour le bien-être de vos enfants en 2025 (activités, équipements) ? Quel montant ?",
    en: "Did you pay child wellness expenses in 2025 (activities, equipment)? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit bien-être des enfants PE — max 1 000 $ (doublé en 2025).",
    provinceOnly: ["PE"],
  },
  {
    id: "PE-02", section: "ma_province", order: 372,
    fr: "Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage à l'Î.-P.-É. en 2025 ?",
    en: "Were you a volunteer firefighter or search and rescue volunteer in P.E.I. in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Crédit pompier volontaire / R&S PE remboursable — 500 $ (1 000 $ en 2026).",
    provinceOnly: ["PE"],
  },
  {
    id: "PE-03", section: "ma_province", order: 373,
    fr: "Aviez-vous des enfants de moins de 6 ans à charge en 2025 ? Combien ?",
    en: "Did you have dependant children under 6 in 2025? How many?",
    type: "NUMBER", required: false,
    hint: "Montant jeunes enfants PE — 100 $ / mois / enfant de moins de 6 ans.",
    provinceOnly: ["PE"],
  },
  {
    id: "PE-04", section: "ma_province", order: 374,
    fr: "Avez-vous versé des contributions à un parti politique provincial ou à un candidat à l'Î.-P.-É. en 2025 ? Quel montant ?",
    en: "Did you make contributions to a P.E.I. provincial political party or candidate in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques PE.",
    provinceOnly: ["PE"],
  },

  // ── TERRE-NEUVE-ET-LABRADOR (4 questions) ───────────────────────────────
  {
    id: "NL-01", section: "ma_province", order: 381,
    fr: "Avez-vous payé des frais de chauffage au mazout pour votre résidence en 2025 ? Quel montant ?",
    en: "Did you pay home heating oil costs for your residence in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Supplément chauffage au mazout NL — jusqu'à 500 $ (budget 2025).",
    provinceOnly: ["NL"],
  },
  {
    id: "NL-02", section: "ma_province", order: 382,
    fr: "Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage à T.-N.-L. en 2025 ?",
    en: "Were you a volunteer firefighter or search and rescue volunteer in N.L. in 2025?",
    type: "BOOLEAN", required: false,
    provinceOnly: ["NL"],
  },
  {
    id: "NL-03", section: "ma_province", order: 383,
    fr: "Avez-vous payé des frais de garde d'enfants ou des frais d'adoption en 2025 ? Quel montant ?",
    en: "Did you pay child care expenses or adoption expenses in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédits du formulaire NL428.",
    provinceOnly: ["NL"],
  },
  {
    id: "NL-04", section: "ma_province", order: 384,
    fr: "Avez-vous versé des contributions à un parti politique provincial ou à un candidat à T.-N.-L. en 2025 ? Quel montant ?",
    en: "Did you make contributions to a N.L. provincial political party or candidate in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques NL.",
    provinceOnly: ["NL"],
  },

  // ── TERRITOIRES DU NORD-OUEST (2 questions) ──────────────────────────────
  {
    id: "NT-01", section: "ma_province", order: 391,
    fr: "Combien de jours avez-vous résidé dans une zone prescrite du Nord en 2025 ?",
    en: "How many days did you live in a prescribed northern zone in 2025?",
    type: "NUMBER", required: false,
    hint: "Déduction fédérale pour résidents du Nord T2222 — Zone A : 11,00 $ / jour de base + 11,00 $ / jour additionnel. Partagée avec NU et YT.",
    provinceOnly: ["NT", "NU", "YT"],
  },
  {
    id: "NT-02", section: "ma_province", order: 392,
    fr: "Avez-vous versé des contributions politiques territoriales aux T.N.-O. en 2025 ? Quel montant ?",
    en: "Did you make territorial political contributions in the N.W.T. in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques NT — max 500 $ (100 % des premiers 100 $, 50 % jusqu'à 900 $).",
    provinceOnly: ["NT"],
  },

  // ── NUNAVUT (5 questions) ────────────────────────────────────────────────
  // NT-01 déjà partagé avec provinceOnly: ["NT","NU","YT"]
  {
    id: "NU-02", section: "ma_province", order: 402,
    fr: "Aviez-vous des enfants de moins de 6 ans à charge en 2025 ? Combien ?",
    en: "Did you have dependant children under 6 in 2025? How many?",
    type: "NUMBER", required: false,
    hint: "Montant pour jeunes enfants NU — 1 200 $ / enfant (unique au Nunavut).",
    provinceOnly: ["NU"],
  },
  {
    id: "NU-03", section: "ma_province", order: 403,
    fr: "Étiez-vous parent seul à un moment en 2025 ?",
    en: "Were you a single parent at any time in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Supplément parent seul du crédit coût de la vie NU — max 255,12 $ si revenu > 60 000 $.",
    provinceOnly: ["NU"],
  },
  {
    id: "NU-04", section: "ma_province", order: 404,
    fr: "Avez-vous été bénévole comme pompier ou en recherche et sauvetage au Nunavut en 2025 (50 heures ou plus) ?",
    en: "Did you volunteer as a firefighter or in search and rescue in Nunavut in 2025 (50+ hours)?",
    type: "BOOLEAN", required: false,
    hint: "Nouveau crédit 2025 : 722 $ (minimum 50 heures).",
    provinceOnly: ["NU"],
  },
  {
    id: "NU-05", section: "ma_province", order: 405,
    fr: "Avez-vous versé des contributions politiques territoriales au Nunavut en 2025 ? Quel montant ?",
    en: "Did you make territorial political contributions in Nunavut in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques NU — max 500 $.",
    provinceOnly: ["NU"],
  },

  // ── YUKON (7 questions) ──────────────────────────────────────────────────
  // YT-01 = NT-01 déjà partagé avec provinceOnly: ["NT","NU","YT"]
  {
    id: "YT-02", section: "ma_province", order: 412,
    fr: "Avez-vous engagé des dépenses de fertilité ou de maternité de substitution en 2025 (traitements après le 2 janvier 2024) ? Quel montant ?",
    en: "Did you incur fertility or surrogacy expenses in 2025 (treatments after January 2, 2024)? What amount?",
    type: "MONEY", required: false,
    hint: "Nouveau crédit YT 2025 — 40 % des frais admissibles, max 10 000 $ de frais (max 4 000 $ de crédit).",
    provinceOnly: ["YT"],
  },
  {
    id: "YT-03", section: "ma_province", order: 413,
    fr: "Avez-vous investi dans une entreprise admissible du Yukon en 2025 (certificat YBITC-1) ? Quel montant ?",
    en: "Did you invest in an eligible Yukon business in 2025 (YBITC-1 certificate)? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit d'investissement d'entreprise YT — 25 %, max 25 000 $ / an (report 3 ans arrière / 7 ans avant).",
    provinceOnly: ["YT"],
  },
  {
    id: "YT-04", section: "ma_province", order: 414,
    fr: "Résidiez-vous sur des terres visées par une entente d'une Première Nation du Yukon en 2025 ?",
    en: "Did you live on Yukon First Nation settlement land in 2025?",
    type: "BOOLEAN", required: false,
    hint: "Crédit d'impôt des Premières Nations YT — 95 % de l'impôt territorial (formulaire YT432).",
    provinceOnly: ["YT"],
  },
  {
    id: "YT-05", section: "ma_province", order: 415,
    fr: "Avez-vous payé des frais d'activités physiques pour vos enfants en 2025 ? Quel montant par enfant ?",
    en: "Did you pay children's physical activity fees in 2025? What amount per child?",
    type: "MONEY", required: false,
    hint: "Crédit condition physique des enfants YT — 6,4 %, max 1 000 $ / enfant (+500 $ si CIPH).",
    provinceOnly: ["YT"],
  },
  {
    id: "YT-06", section: "ma_province", order: 416,
    fr: "Avez-vous payé des frais d'adoption en 2025 ? Quel montant ?",
    en: "Did you pay adoption expenses in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Frais d'adoption YT — max 19 580 $.",
    provinceOnly: ["YT"],
  },
  {
    id: "YT-07", section: "ma_province", order: 417,
    fr: "Avez-vous versé des contributions politiques territoriales au Yukon en 2025 ? Quel montant ?",
    en: "Did you make territorial political contributions in Yukon in 2025? What amount?",
    type: "MONEY", required: false,
    hint: "Crédit contributions politiques YT — max 650 $.",
    provinceOnly: ["YT"],
  },
];

// ─── Helper: filtrer les questions par province ───────────────────────────────
export function getQuestionsForProvince(
  province: string,
  module: Question[] = MODULE_MA_PROVINCE
): Question[] {
  return module.filter(q =>
    !q.provinceOnly || q.provinceOnly.includes(province)
  );
}

// ─── Helper: résumé des questions par province ───────────────────────────────
export function getProvinceQuestionCount(): Record<string, number> {
  const codes = ["QC","ON","BC","AB","SK","MB","NB","NS","PE","NL","NT","NU","YT"];
  const result: Record<string, number> = {};
  for (const code of codes) {
    result[code] = getQuestionsForProvince(code).length;
  }
  return result;
}
