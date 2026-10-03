// ═══════════════════════════════════════════════════════════════
// RÈGLES FISCALES 2025 — 13 provinces/territoires + fédéral
// Sources vérifiées:
//   ARC T4032 2025 (guide retenues sur la paie)
//   Budgets provinciaux 2025
//   Formulaires 428/479 provinciaux 2025
//   Revenu Québec TP-1 2025
// VERSION: 2025.CA.2.0
// ⚠️ Calculs PRÉLIMINAIRES — non officiels — non certifiés NETFILE
// ═══════════════════════════════════════════════════════════════

import type { TaxRulesForYear, BasicPersonalAmountConfig, CreditRateConfig } from "../types";

// ─── HELPERS ─────────────────────────────────────────────────
// Convertit dollars → cents
const d = (dollars: number) => Math.round(dollars * 100);

// BPA simple (sans élimination progressive)
const bpa = (amountDollars: number): BasicPersonalAmountConfig => ({
  fullAmountCents: d(amountDollars),
});

// BPA avec élimination progressive
const bpaPhaseOut = (
  full: number, min: number, start: number, end: number
): BasicPersonalAmountConfig => ({
  fullAmountCents: d(full),
  minAmountCents: d(min),
  phaseOutStartCents: d(start),
  phaseOutEndCents: d(end),
});

// Taux de crédit = taux du 1er palier
const creditRate = (rateBP: number): CreditRateConfig => ({ baseRateBP: rateBP });

// ─── PALIERS FÉDÉRAUX 2025 ────────────────────────────────────
// Source: ARC T4032-2025, Annexe 1
// BPA fédéral: 16 129 $ (source: budget fédéral 2025, taux proratisé 14,5%)
// Note: taux 1er palier = 14,5% en 2025 (15% jan-jun + 14% jul-déc)
// Pour simplicité et conformité ARC: on utilise 15% (méthode T4032 officielle)
const FEDERAL_BRACKETS_2025 = [
  { minCents: d(0),        maxCents: d(57_375),   rateBasisPoints: 1500 },
  { minCents: d(57_375),   maxCents: d(114_750),  rateBasisPoints: 2050 },
  { minCents: d(114_750),  maxCents: d(158_519),  rateBasisPoints: 2600 },
  { minCents: d(158_519),  maxCents: d(220_000),  rateBasisPoints: 2900 },
  { minCents: d(220_000),  maxCents: null,         rateBasisPoints: 3300 },
];

// BPA fédéral 2025: 16 129 $ (plein) → 14 538 $ (revenu > 177 882 $)
const FEDERAL_BPA_2025: BasicPersonalAmountConfig = bpaPhaseOut(
  16_129, 14_538, 177_882, 253_414
);

// ─── FÉDÉRAL (CA) ────────────────────────────────────────────
export const FEDERAL_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "CA",
  rulesVersion: "2025.CA.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(0),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: 0,
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [],
  // ⚠️ Ligne 34990: crédits calculés à 14,5% (pas 15%)
  // Crédit compensatoire = (A − 8 319,38$) × 3,45% en sus
  // Voir: provincial-engine.ts pour le calcul exact
  federalCreditRate: creditRate(1450), // 14,5% — taux réel 2025
  provincialCreditRate: creditRate(0),
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "T1",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── QUÉBEC (QC) ─────────────────────────────────────────────
// Source: Revenu Québec TP-1, Guide 2025
// RRQ (pas RPC), RQAP, Assurance médicaments, crédit solidarité
export const QC_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "QC",
  rulesVersion: "2025.QC.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(17_183),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(17_183),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    // Source: Revenu Québec TP-1 2025 — indexation 2,85%
    { minCents: d(0),         maxCents: d(53_255),  rateBasisPoints: 1400 },
    { minCents: d(53_255),    maxCents: d(106_495), rateBasisPoints: 1900 },
    { minCents: d(106_495),   maxCents: d(129_590), rateBasisPoints: 2400 },
    { minCents: d(129_590),   maxCents: null,        rateBasisPoints: 2575 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(1400),
  refundableCredits: [
    {
      code: "QC_SOLIDARITY",
      nameFr: "Crédit d'impôt pour solidarité",
      nameEn: "Solidarity tax credit",
      isRefundable: true,
      // Montant de base: composante TVQ + logement + nordique selon situation
      fixedAmountCents: d(362), // composante TVQ de base individuel
    },
    {
      code: "QC_CHILDCARE",
      nameFr: "Crédit pour frais de garde (remboursable)",
      nameEn: "Childcare expenses credit (refundable)",
      isRefundable: true,
      // Taux 75% à 26% selon revenu
      phaseOutStartCents: d(34_610),
      maxAmountCents: d(11_000), // 75% × 14 666$ max
    },
  ],
  corporate: {
    generalRateBP: 1100,        // 11,0%
    smallBusinessRateBP: 350,   // 3,5% (DPE QC: 500 k$)
    smallBusinessLimitCents: d(500_000),
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "TP-1",
  hasOwnAgency: true,
  agencyFr: "Revenu Québec",
  agencyEn: "Revenu Québec",
  pensionPlanCode: "QPP",
  hasRQAP: true,
};

// ─── ONTARIO (ON) ────────────────────────────────────────────
// Source: ARC T4032, Formulaire ON428, ON479 2025
// Surtaxe ON: 20% sur impôt > 5 315 $, +36% sur impôt > 6 802 $
export const ON_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "ON",
  rulesVersion: "2025.ON.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(11_141),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(11_141),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(51_446),  rateBasisPoints:  505 },
    { minCents: d(51_446),    maxCents: d(102_894), rateBasisPoints:  915 },
    { minCents: d(102_894),   maxCents: d(150_000), rateBasisPoints: 1116 },
    { minCents: d(150_000),   maxCents: d(220_000), rateBasisPoints: 1216 },
    { minCents: d(220_000),   maxCents: null,        rateBasisPoints: 1316 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(505),
  // SURTAXE ON — seule province avec surtaxe en 2025
  provincialSurtax: {
    // Source: ARC T4032 ON 2025 — seule province avec surtaxe en 2025
    threshold1Cents: d(5_710),
    rateBP1: 2000,  // +20% sur l'impôt de base > 5 710$
    threshold2Cents: d(7_307),
    rateBP2: 3600,  // +36% cumulatif sur l'impôt de base > 7 307$
  },
  refundableCredits: [
    {
      code: "ON_TRILLIUM",
      nameFr: "Prestation Trillium de l'Ontario",
      nameEn: "Ontario Trillium Benefit",
      isRefundable: true,
      // Composantes: crédit énergie (ON-ENERGY) + crédit taxe de vente (OSTC) + logement nord (NOEC)
      fixedAmountCents: d(158), // OSTC de base 2025
    },
    {
      code: "ON_SENIORS",
      nameFr: "Crédit d'impôt pour les aînés de l'Ontario",
      nameEn: "Ontario Senior Homeowners' Property Tax Grant",
      isRefundable: true,
      fixedAmountCents: d(500),
    },
  ],
  corporate: {
    generalRateBP: 1150,       // 11,5%
    smallBusinessRateBP: 350,  // 3,5%
    smallBusinessLimitCents: d(500_000),
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "ON428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── ALBERTA (AB) ────────────────────────────────────────────
// Source: Alberta AT1, Budget AB 2025
// NOUVEAUTÉ 2025: 6 paliers (nouveau 8% sur premiers 60 000$)
// BPA AB 2025: 22 323$ — le plus élevé au Canada
// Taux crédit NR: 8% (pas 10%) + 2% supplémentaire sur crédits > 60 000$
// Déclaration AT1 séparée (pas via ARC comme les autres)
export const AB_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "AB",
  rulesVersion: "2025.AB.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(22_323),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(22_323),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(60_000),  rateBasisPoints:  800 }, // NOUVEAU 2025
    { minCents: d(60_000),    maxCents: d(148_269), rateBasisPoints: 1000 },
    { minCents: d(148_269),   maxCents: d(177_922), rateBasisPoints: 1200 },
    { minCents: d(177_922),   maxCents: d(237_230), rateBasisPoints: 1300 },
    { minCents: d(237_230),   maxCents: d(355_845), rateBasisPoints: 1400 },
    { minCents: d(355_845),   maxCents: null,        rateBasisPoints: 1500 },
  ],
  federalCreditRate: creditRate(1500),
  // AB: taux crédit = 8% de base + 2% supplémentaire si crédits > 60 000$
  provincialCreditRate: {
    baseRateBP: 800,
    supplementalRateBP: 200,
    supplementalThresholdCents: d(60_000),
  },
  refundableCredits: [
    {
      code: "AB_ACFB",
      nameFr: "Prestation pour les familles de l'Alberta",
      nameEn: "Alberta Child and Family Benefit",
      isRefundable: true,
      phaseOutStartCents: d(25_935),
      maxAmountCents: d(6_832), // 4 enfants max
    },
    {
      code: "AB_SENIORS",
      nameFr: "Avantage pour les aînés de l'Alberta",
      nameEn: "Alberta Seniors Benefit",
      isRefundable: true,
      fixedAmountCents: d(1_080), // célibataire max
    },
  ],
  corporate: {
    generalRateBP: 800,        // 8,0%
    smallBusinessRateBP: 200,  // 2,0%
    smallBusinessLimitCents: d(500_000),
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "AT1",  // déclaration provinciale séparée (comme QC)
  hasOwnAgency: true,     // Alberta Treasury Board — pas ARC
  agencyFr: "Agence du revenu du Canada (perçoit pour AB)",
  agencyEn: "Canada Revenue Agency (collects for AB)",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── COLOMBIE-BRITANNIQUE (BC) ───────────────────────────────
// Source: ARC T4032, Formulaire BC428, BC479 2025
// BPA BC 2025: 12 932$ (indexé 2,8%)
// CHANGEMENT 2025: crédit d'action climatique ANNULÉ (taxe carbone éliminée 1er avril 2025)
// IDMTC passe de 17,5% → 25% le 1er sept 2025 (crédit entreprises médias)
export const BC_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "BC",
  rulesVersion: "2025.BC.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(12_932),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(12_932),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(45_654),  rateBasisPoints:  506 },
    { minCents: d(45_654),    maxCents: d(91_310),  rateBasisPoints:  770 },
    { minCents: d(91_310),    maxCents: d(104_835), rateBasisPoints: 1050 },
    { minCents: d(104_835),   maxCents: d(127_299), rateBasisPoints: 1229 },
    { minCents: d(127_299),   maxCents: d(172_602), rateBasisPoints: 1470 },
    { minCents: d(172_602),   maxCents: d(240_716), rateBasisPoints: 1680 },
    { minCents: d(240_716),   maxCents: null,        rateBasisPoints: 2050 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(506),
  // NOTE: Crédit d'action climatique BC = 0$ en 2025 (taxe carbone éliminée)
  refundableCredits: [
    {
      code: "BC_CTC",
      nameFr: "Crédit de taxe de vente C.-B. (remboursable)",
      nameEn: "BC Sales Tax Credit",
      isRefundable: true,
      fixedAmountCents: d(75), // individuel sans enfant
      phaseOutStartCents: d(36_301),
    },
  ],
  corporate: {
    generalRateBP: 1200,       // 12,0%
    smallBusinessRateBP: 200,  // 2,0%
    smallBusinessLimitCents: d(500_000),
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "BC428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── SASKATCHEWAN (SK) ───────────────────────────────────────
// Source: ARC T4032, SK428 2025
// BPA SK 2025: 19 491$ (TD1SK officiel — Affordability Act +500$/an + indexation 2,7%)
// NOUVEAUTÉS 2025: Active Families Benefit doublée (300$/enfant), crédit fertilité 50%
export const SK_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "SK",
  rulesVersion: "2025.SK.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(19_491),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(19_491),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(49_720),  rateBasisPoints: 1050 },
    { minCents: d(49_720),    maxCents: d(142_058), rateBasisPoints: 1250 },
    { minCents: d(142_058),   maxCents: null,        rateBasisPoints: 1450 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(1050),
  refundableCredits: [
    {
      code: "SK_SAFL",
      nameFr: "Prestation pour les familles actives SK",
      nameEn: "Active Families Benefit",
      isRefundable: true,
      fixedAmountCents: d(300), // par enfant, max 120 000$ revenu familial
    },
    {
      code: "SK_FERTILITY",
      nameFr: "Crédit fertilité SK (nouveau 2025)",
      nameEn: "SK Fertility Treatment Tax Credit",
      isRefundable: true,
      // 50% des frais admissibles, max 10 000$ de frais
      maxAmountCents: d(5_000),
    },
  ],
  corporate: {
    generalRateBP: 1200,       // 12,0%
    smallBusinessRateBP: 100,  // 1,0% (le plus bas au Canada hors MB/YT)
    smallBusinessLimitCents: d(600_000), // seuil le plus élevé avec NS
    manufacturingRateBP: 1000, // 10,0% M&P (seule province avec M&P distinct)
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "SK428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── MANITOBA (MB) ───────────────────────────────────────────
// Source: ARC T4032, MB428 2025
// BPA MB 2025: 15 969$ MAIS élimination progressive 200 000$ → 400 000$ (NOUVEAUTÉ 2025)
// Taux MB indexé 1,2% — gelé pour 2026
// Crédit locataires: 575$ (+328$ aînés de 55 ans et +)
export const MB_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "MB",
  rulesVersion: "2025.MB.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  // BPA MB avec élimination progressive (nouveauté 2025)
  provincialBasicPersonalConfig: bpaPhaseOut(
    15_969, // plein (revenu < 200 000$)
    0,      // éliminé (revenu > 400 000$)
    200_000,
    400_000
  ),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(15_969),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(47_000),  rateBasisPoints: 1080 }, // 101 200$ selon ARC (coquille: 100 200$)
    { minCents: d(47_000),    maxCents: d(101_200), rateBasisPoints: 1275 },
    { minCents: d(101_200),   maxCents: null,        rateBasisPoints: 1740 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(1080),
  refundableCredits: [
    {
      code: "MB_RENT",
      nameFr: "Crédit d'impôt pour les locataires MB",
      nameEn: "Manitoba Renters Tax Credit",
      isRefundable: true,
      fixedAmountCents: d(575), // +328$ si 55 ans et +
    },
    {
      code: "MB_CHILDCARE",
      nameFr: "Crédit pour frais de garde MB",
      nameEn: "Manitoba Child Care Credit",
      isRefundable: true,
      // MITC: 1% non remboursable + 7% remboursable
      maxAmountCents: d(1_400), // 7% × 20 000$
    },
  ],
  corporate: {
    generalRateBP: 1200,       // 12,0%
    smallBusinessRateBP: 0,    // 0% ! (Manitoba = 0% + plafond 500k$)
    smallBusinessLimitCents: d(500_000),
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "MB428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── NOUVEAU-BRUNSWICK (NB) ──────────────────────────────────
// Source: ARC T4032, NB428 2025
// BPA NB 2025: 13 396$ (indexé 2,7%)
// 4 paliers (pas 5 — correction du rapport ChatGPT confirmée)
export const NB_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "NB",
  rulesVersion: "2025.NB.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(13_396),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(13_396),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(47_715),  rateBasisPoints:  940 },
    { minCents: d(47_715),    maxCents: d(95_431),  rateBasisPoints: 1400 },
    { minCents: d(95_431),    maxCents: d(176_756), rateBasisPoints: 1600 },
    { minCents: d(176_756),   maxCents: null,        rateBasisPoints: 1950 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(940),
  refundableCredits: [
    {
      code: "NB_LOWINE",
      nameFr: "Supplément de revenu pour les personnes à faible revenu NB",
      nameEn: "NB Low-Income Tax Reduction",
      isRefundable: true,
      fixedAmountCents: d(262),
    },
  ],
  corporate: {
    generalRateBP: 1400,       // 14,0%
    smallBusinessRateBP: 250,  // 2,5%
    smallBusinessLimitCents: d(500_000),
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "NB428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── NOUVELLE-ÉCOSSE (NS) ────────────────────────────────────
// Source: ARC T4032, NS428 2025, Budget NS 2025
// BPA NS 2025: 11 744$ — rendu UNIVERSEL en 2025 (pas de réduction 25k-75k$)
// Aucune surtaxe en 2025
// Taux sociétés: 2,5%→1,5% PE et 500k$→700k$ plafond le 1er avril 2025
// → taux mixte 2025: ~1,75%, plafond ~650 685$
export const NS_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "NS",
  rulesVersion: "2025.NS.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(11_744),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(11_744),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(29_590),  rateBasisPoints:  879 },
    { minCents: d(29_590),    maxCents: d(59_180),  rateBasisPoints: 1495 },
    { minCents: d(59_180),    maxCents: d(93_000),  rateBasisPoints: 1700 },
    { minCents: d(93_000),    maxCents: d(150_000), rateBasisPoints: 2100 },
    { minCents: d(150_000),   maxCents: null,        rateBasisPoints: 2100 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(879),
  // Taux mixte intra-année pour les sociétés (changement 1er avril 2025)
  corporate: [
    {
      generalRateBP: 1400,
      smallBusinessRateBP: 250,      // 2,5% → jan-mars 2025
      smallBusinessLimitCents: d(500_000),
      effectiveFrom: "2025-01-01",
      effectiveTo: "2025-03-31",
    },
    {
      generalRateBP: 1400,
      smallBusinessRateBP: 150,      // 1,5% → avr-déc 2025
      smallBusinessLimitCents: d(700_000),
      effectiveFrom: "2025-04-01",
      effectiveTo: "2025-12-31",
    },
  ],
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "NS428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── ÎLE-DU-PRINCE-ÉDOUARD (PE) ─────────────────────────────
// Source: ARC T4032, PE428 2025, Budget PE 2025
// BPA PE 2025: 14 650$ (budget 2025 — pas 14 250$ de 2024)
// 5 paliers (pas 3) — surtaxe ÉLIMINÉE depuis 2024
// Taux société: 16%→15% et 500k$→600k$ le 1er juillet 2025
export const PE_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "PE",
  rulesVersion: "2025.PE.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(14_650),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(14_650),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(32_656),  rateBasisPoints:  950 },
    { minCents: d(32_656),    maxCents: d(64_313),  rateBasisPoints: 1347 },
    { minCents: d(64_313),    maxCents: d(105_000), rateBasisPoints: 1660 },
    { minCents: d(105_000),   maxCents: d(140_000), rateBasisPoints: 1762 },
    { minCents: d(140_000),   maxCents: null,        rateBasisPoints: 1900 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(950),
  // Taux sociétés: changement intra-année au 1er juillet 2025
  corporate: [
    {
      generalRateBP: 1600,
      smallBusinessRateBP: 100,
      smallBusinessLimitCents: d(500_000),
      effectiveFrom: "2025-01-01",
      effectiveTo: "2025-06-30",
    },
    {
      generalRateBP: 1500,
      smallBusinessRateBP: 100,
      smallBusinessLimitCents: d(600_000),
      effectiveFrom: "2025-07-01",
      effectiveTo: "2025-12-31",
    },
  ],
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "PE428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── TERRE-NEUVE-ET-LABRADOR (NL) ───────────────────────────
// Source: ARC T4032, NL428 2025
// BPA NL 2025: 11 067$ (indexé ~2,3%)
// 8 paliers — le plus complexe au Canada
export const NL_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "NL",
  rulesVersion: "2025.NL.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(11_067),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(11_067),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(43_198),  rateBasisPoints:  870 },
    { minCents: d(43_198),    maxCents: d(86_395),  rateBasisPoints: 1450 },
    { minCents: d(86_395),    maxCents: d(154_244), rateBasisPoints: 1580 },
    { minCents: d(154_244),   maxCents: d(215_943), rateBasisPoints: 1780 },
    { minCents: d(215_943),   maxCents: d(275_870), rateBasisPoints: 1980 },
    { minCents: d(275_870),   maxCents: d(551_739), rateBasisPoints: 2080 },
    { minCents: d(551_739),   maxCents: d(1_103_478), rateBasisPoints: 2180 },
    { minCents: d(1_103_478), maxCents: null,          rateBasisPoints: 2180 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(870),
  refundableCredits: [
    {
      code: "NL_SRSF",
      nameFr: "Supplément de revenu pour les aînés NL",
      nameEn: "NL Seniors' Benefit",
      isRefundable: true,
      fixedAmountCents: d(1_441), // max annuel 2025
    },
  ],
  corporate: {
    generalRateBP: 1500,       // 15,0%
    smallBusinessRateBP: 250,  // 2,5%
    smallBusinessLimitCents: d(500_000),
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "NL428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── TERRITOIRES DU NORD-OUEST (NT) ─────────────────────────
// Source: ARC T4032, NT428 2025
// BPA NT 2025: 17 842$ (indexé 2,7%)
// Taux le plus bas au Canada pour les premiers revenus (5,9%)
export const NT_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "NT",
  rulesVersion: "2025.NT.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(17_842),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(17_842),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(50_597),  rateBasisPoints:  590 },
    { minCents: d(50_597),    maxCents: d(101_198), rateBasisPoints:  860 },
    { minCents: d(101_198),   maxCents: d(164_525), rateBasisPoints: 1220 },
    { minCents: d(164_525),   maxCents: null,        rateBasisPoints: 1405 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(590),
  refundableCredits: [
    {
      code: "NT_COST_LIVING",
      nameFr: "Crédit d'impôt pour coût de la vie TNO",
      nameEn: "NT Cost of Living Tax Credit",
      isRefundable: true,
      fixedAmountCents: d(792), // individuel 2025
    },
  ],
  corporate: {
    generalRateBP: 1150,       // 11,5%
    smallBusinessRateBP: 200,  // 2,0%
    smallBusinessLimitCents: d(500_000),
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "NT428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── NUNAVUT (NU) ────────────────────────────────────────────
// Source: ARC T4032, NU428 2025
// BPA NU 2025: 19 274$ — le BPA le PLUS ÉLEVÉ au Canada (tous particuliers)
// Taux les plus bas au Canada (4,0% → 11,5%)
// Fin crédit carbone en 2025
// Nouveau crédit pompiers volontaires + R&S: 722$
export const NU_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "NU",
  rulesVersion: "2025.NU.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  provincialBasicPersonalConfig: bpa(19_274),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(19_274),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(53_268),  rateBasisPoints:  400 },
    { minCents: d(53_268),    maxCents: d(106_537), rateBasisPoints:  700 },
    { minCents: d(106_537),   maxCents: d(173_205), rateBasisPoints:  900 },
    { minCents: d(173_205),   maxCents: null,        rateBasisPoints: 1150 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(400),
  refundableCredits: [
    {
      code: "NU_VOLUNTEER",
      nameFr: "Crédit pompiers volontaires NU (nouveau 2025)",
      nameEn: "NU Volunteer Firefighter & Search and Rescue Credit",
      isRefundable: true,
      fixedAmountCents: d(722), // nouveau 2025
    },
    {
      code: "NU_LOWINE",
      nameFr: "Crédit revenu faible NU",
      nameEn: "NU Low-Income Credit",
      isRefundable: true,
      fixedAmountCents: d(400),
    },
  ],
  corporate: {
    generalRateBP: 1200,       // 12,0%
    smallBusinessRateBP: 300,  // 3,0% (le plus élevé au Canada pour PE)
    smallBusinessLimitCents: d(500_000),
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "NU428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ─── YUKON (YT) ──────────────────────────────────────────────
// Source: ARC T4032, YT428 2025
// BPA YT 2025: 16 129$ (max, avec élimination progressive comme fédéral)
// 5 paliers — surtaxe ÉLIMINÉE depuis 2015 (pas 2025!)
// Nouveau crédit fertilité/maternité de substitution: 40%, max 10 000$
// Crédit Premières Nations: 95% de l'impôt territorial
// Fin remboursement carbone
// Taux M&P distinct: 2,5% (seul territoire avec M&P spécifique)
export const YT_RULES_2025: TaxRulesForYear = {
  taxYear: 2025,
  jurisdiction: "YT",
  rulesVersion: "2025.YT.2.0",
  federalBasicPersonalConfig: FEDERAL_BPA_2025,
  // BPA YT = BPA fédéral (avec même élimination progressive)
  provincialBasicPersonalConfig: bpaPhaseOut(
    16_129, 14_538, 177_882, 253_414
  ),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(16_129),
  federalBrackets: FEDERAL_BRACKETS_2025,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(57_375),  rateBasisPoints:  640 },
    { minCents: d(57_375),    maxCents: d(114_750), rateBasisPoints:  900 },
    { minCents: d(114_750),   maxCents: d(158_519), rateBasisPoints: 1090 },
    { minCents: d(158_519),   maxCents: d(500_000), rateBasisPoints: 1280 },
    { minCents: d(500_000),   maxCents: null,        rateBasisPoints: 1500 },
  ],
  federalCreditRate: creditRate(1500),
  provincialCreditRate: creditRate(640),
  refundableCredits: [
    {
      code: "YT_FERTILITY",
      nameFr: "Crédit fertilité / maternité de substitution YT (nouveau 2025)",
      nameEn: "YT Fertility Treatment and Surrogacy Credit",
      isRefundable: true,
      // 40% des frais admissibles, max 10 000$ de frais → max 4 000$ crédit
      maxAmountCents: d(4_000),
    },
    {
      code: "YT_FIRST_NATIONS",
      nameFr: "Crédit Premières Nations YT",
      nameEn: "YT First Nations Credit",
      isRefundable: true,
      // 95% de l'impôt territorial — calculé sur l'impôt
      phaseOutRateBP: 9500, // 95% de l'impôt YT
    },
  ],
  corporate: {
    generalRateBP: 1200,       // 12,0%
    smallBusinessRateBP: 0,    // 0% (comme MB!)
    smallBusinessLimitCents: d(500_000),
    manufacturingRateBP: 250,  // 2,5% M&P (seul territoire avec M&P distinct)
  },
  filingDeadline:  "2026-04-30",
  paymentDeadline: "2026-04-30",
  provincialForm: "YT428",
  hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada",
  agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP",
  hasRQAP: false,
};

// ═══════════════════════════════════════════════════════════════
// REGISTRE COMPLET — 14 juridictions (1 fédéral + 13 prov/terr)
// ═══════════════════════════════════════════════════════════════

export const RULES_REGISTRY_2025: Record<string, TaxRulesForYear> = {
  "2025_CA": FEDERAL_RULES_2025,
  "2025_QC": QC_RULES_2025,
  "2025_ON": ON_RULES_2025,
  "2025_AB": AB_RULES_2025,
  "2025_BC": BC_RULES_2025,
  "2025_SK": SK_RULES_2025,
  "2025_MB": MB_RULES_2025,
  "2025_NB": NB_RULES_2025,
  "2025_NS": NS_RULES_2025,
  "2025_PE": PE_RULES_2025,
  "2025_NL": NL_RULES_2025,
  "2025_NT": NT_RULES_2025,
  "2025_NU": NU_RULES_2025,
  "2025_YT": YT_RULES_2025,
};

export function getRulesForYearAndProvince(
  taxYear: number,
  province: string
): TaxRulesForYear | null {
  return RULES_REGISTRY_2025[`${taxYear}_${province}`] ?? null;
}

export function getSupportedYears(): number[] {
  return [2025];
}

export function getSupportedProvinces(taxYear: number): string[] {
  return Object.keys(RULES_REGISTRY_2025)
    .filter(k => k.startsWith(`${taxYear}_`))
    .map(k => k.split("_")[1]);
}

export function getProvinceSummary(province: string): {
  nameFr: string; nameEn: string;
  bpaCents: number; brackets: number;
  hasSurtax: boolean; hasOwnAgency: boolean;
} {
  const r = getRulesForYearAndProvince(2025, province);
  if (!r) return { nameFr: province, nameEn: province, bpaCents: 0, brackets: 0, hasSurtax: false, hasOwnAgency: false };

  const NAMES: Record<string, { fr: string; en: string }> = {
    CA: { fr: "Fédéral",                    en: "Federal"                      },
    QC: { fr: "Québec",                     en: "Quebec"                       },
    ON: { fr: "Ontario",                    en: "Ontario"                      },
    AB: { fr: "Alberta",                    en: "Alberta"                      },
    BC: { fr: "Colombie-Britannique",       en: "British Columbia"             },
    SK: { fr: "Saskatchewan",              en: "Saskatchewan"               },
    MB: { fr: "Manitoba",                   en: "Manitoba"                     },
    NB: { fr: "Nouveau-Brunswick",          en: "New Brunswick"                },
    NS: { fr: "Nouvelle-Écosse",            en: "Nova Scotia"                  },
    PE: { fr: "Île-du-Prince-Édouard",      en: "Prince Edward Island"         },
    NL: { fr: "Terre-Neuve-et-Labrador",   en: "Newfoundland and Labrador"   },
    NT: { fr: "Territoires du Nord-Ouest", en: "Northwest Territories"        },
    NU: { fr: "Nunavut",                    en: "Nunavut"                      },
    YT: { fr: "Yukon",                      en: "Yukon"                        },
  };

  return {
    nameFr:         NAMES[province]?.fr ?? province,
    nameEn:         NAMES[province]?.en ?? province,
    bpaCents:       r.provincialBasicPersonalCents,
    brackets:       r.provincialBrackets.length,
    hasSurtax:      !!r.provincialSurtax,
    hasOwnAgency:   r.hasOwnAgency,
  };
}
