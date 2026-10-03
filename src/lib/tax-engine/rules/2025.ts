// ═══════════════════════════════════════════════════════════════
// RÈGLES FISCALES 2025 — 14 juridictions complètes
// Source: easytax-tax-data-2025/ (paquet vérifié 2026-10-03)
//   ARC T4032 2025, Revenu Québec TP-1 2025, loi C-4 (B = 14,5%)
//   Budgets provinciaux/territoriaux 2025
// VERSION: 2025.v3.0
// ⚠️ Calculs PRÉLIMINAIRES — non certifiés NETFILE
// ═══════════════════════════════════════════════════════════════

import type { TaxRulesForYear, BasicPersonalAmountConfig, CreditRateConfig } from "../types";

// ─── HELPERS ─────────────────────────────────────────────────
const d = (dollars: number) => Math.round(dollars * 100);

const bpa = (amount: number): BasicPersonalAmountConfig => ({
  fullAmountCents: d(amount),
});

const bpaPhaseOut = (full: number, min: number, start: number, end: number): BasicPersonalAmountConfig => ({
  fullAmountCents: d(full),
  minAmountCents: d(min),
  phaseOutStartCents: d(start),
  phaseOutEndCents: d(end),
});

const creditRate = (rateBP: number): CreditRateConfig => ({ baseRateBP: rateBP });

// ─── PALIERS FÉDÉRAUX 2025 ────────────────────────────────────
// Loi C-4 (sanction royale 2026-03-12): taux proratisé 14,5%
// (15% jan-jun + 14% juil-déc). Méthode T4032 officielle: 14,5%.
const FED_BRACKETS = [
  { minCents: d(0),        maxCents: d(57_375),  rateBasisPoints: 1450 }, // 14,5%
  { minCents: d(57_375),   maxCents: d(114_750), rateBasisPoints: 2050 },
  { minCents: d(114_750),  maxCents: d(177_882), rateBasisPoints: 2600 },
  { minCents: d(177_882),  maxCents: d(253_414), rateBasisPoints: 2900 },
  { minCents: d(253_414),  maxCents: null,        rateBasisPoints: 3300 },
];

// BPA fédéral 2025 — avec élimination progressive
const FED_BPA = bpaPhaseOut(16_129, 14_538, 177_882, 253_414);

// ─── FÉDÉRAL (CA) ────────────────────────────────────────────
export const FEDERAL_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "CA", rulesVersion: "2025.CA.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(0),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: 0,
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [],
  // Taux crédit 14,5% (loi C-4) + ligne 34990 pour restaurer 15% effectif
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(0),
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "T1", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── QUÉBEC (QC) ─────────────────────────────────────────────
// BPA 2025: 18 571$ (indexation 2,85%) — source Revenu Québec/RCGT
// Paliers: 53 255$ / 106 495$ / 129 590$ à 14/19/24/25,75%
// RRQ 6,40% (5,40% base + 1,00% suppl.) / RQAP 0,494%
// Abattement fédéral 16,5% / Déclaration TP-1 (Revenu Québec)
export const QC_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "QC", rulesVersion: "2025.QC.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(18_571),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(18_571),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(53_255),  rateBasisPoints: 1400 },
    { minCents: d(53_255),   maxCents: d(106_495), rateBasisPoints: 1900 },
    { minCents: d(106_495),  maxCents: d(129_590), rateBasisPoints: 2400 },
    { minCents: d(129_590),  maxCents: null,        rateBasisPoints: 2575 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(1400),
  refundableCredits: [
    { code: "QC_SOLIDARITY", nameFr: "Crédit de solidarité", nameEn: "Solidarity credit", isRefundable: true, fixedAmountCents: d(356) },
  ],
  corporate: { generalRateBP: 1150, smallBusinessRateBP: 320, smallBusinessLimitCents: d(500_000) },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "TP-1", hasOwnAgency: true,
  agencyFr: "Revenu Québec", agencyEn: "Revenu Québec",
  pensionPlanCode: "QPP", hasRQAP: true,
};

// ─── ONTARIO (ON) ────────────────────────────────────────────
// BPA 2025: 12 747$ (indexé au facteur ON)
// Surtaxe: 20% sur impôt de base > 5 710$, +36% sur impôt > 7 307$
// Prime santé: 0$→900$ selon revenu imposable
export const ON_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "ON", rulesVersion: "2025.ON.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(12_747),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(12_747),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(52_886),  rateBasisPoints:  505 },
    { minCents: d(52_886),   maxCents: d(105_775), rateBasisPoints:  915 },
    { minCents: d(105_775),  maxCents: d(150_000), rateBasisPoints: 1116 },
    { minCents: d(150_000),  maxCents: d(220_000), rateBasisPoints: 1216 },
    { minCents: d(220_000),  maxCents: null,        rateBasisPoints: 1316 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(505),
  provincialSurtax: {
    // Seuils 2025 non indexés — source: ARC T4032 ON 2025 / rules-2025.json
    threshold1Cents: d(5_710), rateBP1: 2000,
    threshold2Cents: d(7_307), rateBP2: 3600,
  },
  refundableCredits: [
    { code: "ON_LIFT", nameFr: "LIFT — faible revenu", nameEn: "LIFT", isRefundable: false, maxAmountCents: d(875) },
    { code: "ON_CARE", nameFr: "CARE — garde d'enfants", nameEn: "CARE", isRefundable: true, maxAmountCents: d(6_000) },
  ],
  corporate: { generalRateBP: 1150, smallBusinessRateBP: 320, smallBusinessLimitCents: d(500_000) },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "ON428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── ALBERTA (AB) ────────────────────────────────────────────
// BPA 2025: 22 323$ (indexé 2,0%) — le plus élevé parmi les provinces
// 6 paliers (nouveau 8% sur 0-60 000$, nouveauté 2025 année entière)
// Taux crédit: 8% (AB428) + 2% supplémentaire sur crédits > 60 000$
// Déclaration AT1 distincte (pas d'accord ARC — comme QC)
export const AB_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "AB", rulesVersion: "2025.AB.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(22_323),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(22_323),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(60_000),  rateBasisPoints:  800 },
    { minCents: d(60_000),   maxCents: d(151_234), rateBasisPoints: 1000 },
    { minCents: d(151_234),  maxCents: d(181_481), rateBasisPoints: 1200 },
    { minCents: d(181_481),  maxCents: d(241_974), rateBasisPoints: 1300 },
    { minCents: d(241_974),  maxCents: d(362_961), rateBasisPoints: 1400 },
    { minCents: d(362_961),  maxCents: null,        rateBasisPoints: 1500 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: { baseRateBP: 800, supplementalRateBP: 200, supplementalThresholdCents: d(60_000) },
  refundableCredits: [
    { code: "AB_ACFB", nameFr: "Prestation pour familles AB (ACFB)", nameEn: "Alberta Child and Family Benefit", isRefundable: true, maxAmountCents: d(5_768) },
  ],
  corporate: { generalRateBP: 800, smallBusinessRateBP: 200, smallBusinessLimitCents: d(500_000) },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "AT1", hasOwnAgency: true,
  agencyFr: "ARC perçoit pour AB (AT1 distincte)", agencyEn: "CRA collects for AB (separate AT1)",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── COLOMBIE-BRITANNIQUE (BC) ───────────────────────────────
// BPA 2025: 12 932$ (indexé 2,8%)
// Crédit climatique BC ÉLIMINÉ le 1er avril 2025 — ne pas modéliser
export const BC_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "BC", rulesVersion: "2025.BC.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(12_932),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(12_932),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(49_279),  rateBasisPoints:  506 },
    { minCents: d(49_279),   maxCents: d(98_560),  rateBasisPoints:  770 },
    { minCents: d(98_560),   maxCents: d(113_158), rateBasisPoints: 1050 },
    { minCents: d(113_158),  maxCents: d(137_407), rateBasisPoints: 1229 },
    { minCents: d(137_407),  maxCents: d(186_306), rateBasisPoints: 1470 },
    { minCents: d(186_306),  maxCents: d(259_829), rateBasisPoints: 1680 },
    { minCents: d(259_829),  maxCents: null,        rateBasisPoints: 2050 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(506),
  refundableCredits: [
    { code: "BC_RENTERS", nameFr: "Crédit locataires C.-B.", nameEn: "BC Renters Tax Credit", isRefundable: true, maxAmountCents: d(400), phaseOutStartCents: d(64_764), phaseOutRateBP: 200 },
    // BCCATC: éliminé 2025-04-01 — kind: "none" dans credits-provincial-2025.json
  ],
  corporate: { generalRateBP: 1200, smallBusinessRateBP: 200, smallBusinessLimitCents: d(500_000) },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "BC428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── SASKATCHEWAN (SK) ───────────────────────────────────────
// BPA 2025: 19 491$ (2,7% indexation + 500$/an Affordability Act)
// Seuil PE le plus élevé au Canada: 600 000$
export const SK_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "SK", rulesVersion: "2025.SK.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(19_491),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(19_491),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(53_463),  rateBasisPoints: 1050 },
    { minCents: d(53_463),   maxCents: d(152_750), rateBasisPoints: 1250 },
    { minCents: d(152_750),  maxCents: null,        rateBasisPoints: 1450 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(1050),
  refundableCredits: [
    { code: "SK_AFB",       nameFr: "Active Families Benefit", nameEn: "Active Families Benefit", isRefundable: true, maxAmountCents: d(300)   },
    { code: "SK_FERTILITY", nameFr: "Crédit fertilité SK",      nameEn: "SK Fertility Credit",      isRefundable: true, maxAmountCents: d(10_000), phaseInRateBP: 5000 },
    { code: "SK_SLITC",     nameFr: "SLITC — faible revenu",    nameEn: "SK Low-Income Tax Credit", isRefundable: true },
  ],
  corporate: { generalRateBP: 1200, smallBusinessRateBP: 100, smallBusinessLimitCents: d(600_000), manufacturingRateBP: 1000 },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "SK428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── MANITOBA (MB) ───────────────────────────────────────────
// BPA 2025: 15 969$ — phase-out 200 000$→400 000$ (nouveauté 2025)
// Paliers: 47 564$ / 101 200$ (source: rules-2025.json)
// PE sociétés: 0% (avec Yukon, seules juridictions à 0%)
export const MB_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "MB", rulesVersion: "2025.MB.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpaPhaseOut(15_969, 0, 200_000, 400_000),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(15_969),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(47_564),  rateBasisPoints: 1080 },
    { minCents: d(47_564),   maxCents: d(101_200), rateBasisPoints: 1275 },
    { minCents: d(101_200),  maxCents: null,        rateBasisPoints: 1740 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(1080),
  refundableCredits: [
    { code: "MB_RENTERS",   nameFr: "Crédit locataires MB",    nameEn: "MB Renters Tax Credit",   isRefundable: true, fixedAmountCents: d(575)    },
    { code: "MB_HOMEOWNER", nameFr: "Crédit propriétaires MB", nameEn: "MB Homeowners Credit",    isRefundable: true, maxAmountCents: d(1_500)   },
    { code: "MB_PTC",       nameFr: "Manitoba Personal Tax Credit", nameEn: "MB Personal Tax Credit", isRefundable: true },
  ],
  corporate: { generalRateBP: 1200, smallBusinessRateBP: 0, smallBusinessLimitCents: d(500_000) },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "MB428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── NOUVEAU-BRUNSWICK (NB) ──────────────────────────────────
// BPA 2025: 13 396$ (indexé 2,7%)
// 4 paliers: 51 306$ / 102 614$ / 190 060$ (source: rules-2025.json)
export const NB_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "NB", rulesVersion: "2025.NB.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(13_396),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(13_396),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(51_306),  rateBasisPoints:  940 },
    { minCents: d(51_306),   maxCents: d(102_614), rateBasisPoints: 1400 },
    { minCents: d(102_614),  maxCents: d(190_060), rateBasisPoints: 1600 },
    { minCents: d(190_060),  maxCents: null,        rateBasisPoints: 1950 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(940),
  refundableCredits: [
    { code: "NB_LITR", nameFr: "Réduction faible revenu LITR", nameEn: "NB LITR", isRefundable: false, maxAmountCents: d(1_604) },
  ],
  corporate: { generalRateBP: 1400, smallBusinessRateBP: 250, smallBusinessLimitCents: d(500_000) },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "NB428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── NOUVELLE-ÉCOSSE (NS) ────────────────────────────────────
// BPA 2025: 11 744$ — UNIVERSEL depuis 2025 (phase-out 25k-75k abolie)
// 5 paliers: 30 507$ / 61 015$ / 95 883$ / 154 650$ (source: rules-2025.json)
// Taux corporatif mixte 2025: 1,75% / plafond 650 685$ (changement 1er avr.)
export const NS_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "NS", rulesVersion: "2025.NS.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(11_744),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(11_744),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(30_507),  rateBasisPoints:  879 },
    { minCents: d(30_507),   maxCents: d(61_015),  rateBasisPoints: 1495 },
    { minCents: d(61_015),   maxCents: d(95_883),  rateBasisPoints: 1667 },
    { minCents: d(95_883),   maxCents: d(154_650), rateBasisPoints: 1750 },
    { minCents: d(154_650),  maxCents: null,        rateBasisPoints: 2100 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(879),
  refundableCredits: [
    { code: "NS_ALTC",    nameFr: "NSALTC — vie abordable",   nameEn: "NS Affordable Living Credit", isRefundable: true, fixedAmountCents: d(255) },
    { code: "NS_POVERTY", nameFr: "Crédit réduction pauvreté", nameEn: "NS Poverty Reduction",       isRefundable: true, fixedAmountCents: d(250) },
  ],
  corporate: [
    { generalRateBP: 1400, smallBusinessRateBP: 250, smallBusinessLimitCents: d(500_000), effectiveFrom: "2025-01-01", effectiveTo: "2025-03-31" },
    { generalRateBP: 1400, smallBusinessRateBP: 150, smallBusinessLimitCents: d(700_000), effectiveFrom: "2025-04-01", effectiveTo: "2025-12-31" },
  ],
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "NS428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── ÎLE-DU-PRINCE-ÉDOUARD (PE) ─────────────────────────────
// BPA 2025: 14 650$ (budget 2025 — pas 14 250$)
// 5 paliers: 33 328$ / 64 656$ / 105 000$ / 140 000$ (source: rules-2025.json)
// Surtaxe 10% ÉLIMINÉE depuis 2024 — ne pas modéliser
// Taux général: 16%→15% le 1er juillet 2025
export const PE_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "PE", rulesVersion: "2025.PE.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(14_650),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(14_650),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(33_328),  rateBasisPoints:  950 },
    { minCents: d(33_328),   maxCents: d(64_656),  rateBasisPoints: 1347 },
    { minCents: d(64_656),   maxCents: d(105_000), rateBasisPoints: 1660 },
    { minCents: d(105_000),  maxCents: d(140_000), rateBasisPoints: 1762 },
    { minCents: d(140_000),  maxCents: null,        rateBasisPoints: 1900 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(950),
  // ⚠️ Surtaxe éliminée 2024 — NE PAS MODÉLISER
  refundableCredits: [
    { code: "PE_VOLUNTEER", nameFr: "Pompier volontaire PE", nameEn: "PE Volunteer Firefighter", isRefundable: true, fixedAmountCents: d(500) },
  ],
  corporate: [
    { generalRateBP: 1600, smallBusinessRateBP: 100, smallBusinessLimitCents: d(500_000), effectiveFrom: "2025-01-01", effectiveTo: "2025-06-30" },
    { generalRateBP: 1500, smallBusinessRateBP: 100, smallBusinessLimitCents: d(600_000), effectiveFrom: "2025-07-01", effectiveTo: "2025-12-31" },
  ],
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "PE428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── TERRE-NEUVE-ET-LABRADOR (NL) ───────────────────────────
// BPA 2025: 11 067$ (indexé ~2,3%)
// 8 paliers — le plus au Canada
// Taux crédit NR: 8,7% (PREMIER palier — pas 15%)
export const NL_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "NL", rulesVersion: "2025.NL.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(11_067),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(11_067),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),         maxCents: d(44_192),   rateBasisPoints:  870 },
    { minCents: d(44_192),    maxCents: d(88_382),   rateBasisPoints: 1450 },
    { minCents: d(88_382),    maxCents: d(157_792),  rateBasisPoints: 1580 },
    { minCents: d(157_792),   maxCents: d(220_910),  rateBasisPoints: 1780 },
    { minCents: d(220_910),   maxCents: d(282_214),  rateBasisPoints: 1980 },
    { minCents: d(282_214),   maxCents: d(564_429),  rateBasisPoints: 2080 },
    { minCents: d(564_429),   maxCents: d(1_128_858),rateBasisPoints: 2130 },
    { minCents: d(1_128_858), maxCents: null,          rateBasisPoints: 2180 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(870), // 8,7% — PAS 15%
  refundableCredits: [
    { code: "NL_NLIS", nameFr: "Supplément de revenu NLIS", nameEn: "NL Income Supplement", isRefundable: true, maxAmountCents: d(520) },
    { code: "NL_NLSB", nameFr: "Prestation pour aînés NLSB", nameEn: "NL Seniors Benefit",  isRefundable: true, maxAmountCents: d(1_551) },
  ],
  corporate: { generalRateBP: 1500, smallBusinessRateBP: 250, smallBusinessLimitCents: d(500_000) },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "NL428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── TERRITOIRES DU NORD-OUEST (NT) ─────────────────────────
// BPA 2025: 17 842$ (indexé 2,7%)
// 4 paliers: 51 964$ / 103 930$ / 168 967$ (source: rules-2025.json)
// Crédit carbone territorial TERMINÉ avril 2025 — ne pas modéliser
export const NT_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "NT", rulesVersion: "2025.NT.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(17_842),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(17_842),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(51_964),  rateBasisPoints:  590 },
    { minCents: d(51_964),   maxCents: d(103_930), rateBasisPoints:  860 },
    { minCents: d(103_930),  maxCents: d(168_967), rateBasisPoints: 1220 },
    { minCents: d(168_967),  maxCents: null,        rateBasisPoints: 1405 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(590),
  refundableCredits: [
    { code: "NT_COSTLIVING", nameFr: "Crédit coût de la vie TNO", nameEn: "NT Cost of Living Credit", isRefundable: true, maxAmountCents: d(942) },
  ],
  corporate: { generalRateBP: 1150, smallBusinessRateBP: 200, smallBusinessLimitCents: d(500_000) },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "NT428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── NUNAVUT (NU) ────────────────────────────────────────────
// BPA 2025: 19 274$ — le plus élevé de tout le Canada
// Taux 4%→11,5% — les plus bas au Canada
// Crédit carbone territorial TERMINÉ avril 2025 — ne pas modéliser
export const NU_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "NU", rulesVersion: "2025.NU.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpa(19_274),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(19_274),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(54_707),  rateBasisPoints:  400 },
    { minCents: d(54_707),   maxCents: d(109_413), rateBasisPoints:  700 },
    { minCents: d(109_413),  maxCents: d(177_881), rateBasisPoints:  900 },
    { minCents: d(177_881),  maxCents: null,        rateBasisPoints: 1150 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(400),
  refundableCredits: [
    { code: "NU_COSTLIVING",  nameFr: "Crédit coût de la vie NU", nameEn: "NU Cost of Living Credit",       isRefundable: true, maxAmountCents: d(1_500) },
    { code: "NU_YOUNGCHILD",  nameFr: "Montant jeunes enfants NU", nameEn: "NU Young Child Amount",         isRefundable: false, fixedAmountCents: d(1_200) },
    { code: "NU_VOLUNTEER",   nameFr: "Pompier volontaire NU",     nameEn: "NU Volunteer Firefighter 2025", isRefundable: false, fixedAmountCents: d(722) },
  ],
  corporate: { generalRateBP: 1200, smallBusinessRateBP: 300, smallBusinessLimitCents: d(500_000) },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "NU428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ─── YUKON (YT) ──────────────────────────────────────────────
// BPA 2025: 16 129$ (même test de revenu que fédéral)
// 5 paliers: 57 375$ / 114 750$ / 177 882$ / 500 000$ (source: rules-2025.json)
// Surtaxe ÉLIMINÉE depuis 2015 — ne pas modéliser
// M&P: 2,5% (seul territoire avec taux M&P distinct — taux combiné 17,5%)
// Crédit carbone territorial TERMINÉ avril 2025 — ne pas modéliser
export const YT_RULES_2025: TaxRulesForYear = {
  taxYear: 2025, jurisdiction: "YT", rulesVersion: "2025.YT.3.0",
  federalBasicPersonalConfig: FED_BPA,
  provincialBasicPersonalConfig: bpaPhaseOut(16_129, 14_538, 177_882, 253_414),
  federalBasicPersonalCents: d(16_129),
  provincialBasicPersonalCents: d(16_129),
  federalBrackets: FED_BRACKETS,
  provincialBrackets: [
    { minCents: d(0),        maxCents: d(57_375),  rateBasisPoints:  640 },
    { minCents: d(57_375),   maxCents: d(114_750), rateBasisPoints:  900 },
    { minCents: d(114_750),  maxCents: d(177_882), rateBasisPoints: 1090 },
    { minCents: d(177_882),  maxCents: d(500_000), rateBasisPoints: 1280 },
    { minCents: d(500_000),  maxCents: null,        rateBasisPoints: 1500 },
  ],
  federalCreditRate: creditRate(1450),
  provincialCreditRate: creditRate(640),
  refundableCredits: [
    { code: "YT_FERTILITY",    nameFr: "Crédit fertilité YT",       nameEn: "YT Fertility Credit",      isRefundable: true,  maxAmountCents: d(4_000), phaseInRateBP: 4000 },
    { code: "YT_FIRSTNATIONS", nameFr: "Crédit Premières Nations YT",nameEn: "YT First Nations Credit", isRefundable: false, phaseInRateBP: 9500 },
  ],
  corporate: { generalRateBP: 1200, smallBusinessRateBP: 0, smallBusinessLimitCents: d(500_000), manufacturingRateBP: 250 },
  filingDeadline: "2026-04-30", paymentDeadline: "2026-04-30",
  provincialForm: "YT428", hasOwnAgency: false,
  agencyFr: "Agence du revenu du Canada", agencyEn: "Canada Revenue Agency",
  pensionPlanCode: "CPP", hasRQAP: false,
};

// ═══════════════════════════════════════════════════════════════
// REGISTRE COMPLET — 14 juridictions
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

export function getRulesForYearAndProvince(taxYear: number, province: string): TaxRulesForYear | null {
  return RULES_REGISTRY_2025[`${taxYear}_${province}`] ?? null;
}

export function getSupportedProvinces(taxYear: number): string[] {
  return Object.keys(RULES_REGISTRY_2025)
    .filter(k => k.startsWith(`${taxYear}_`))
    .map(k => k.split("_")[1]);
}

export function getProvinceSummary(province: string) {
  const r = getRulesForYearAndProvince(2025, province);
  if (!r) return null;
  const NAMES: Record<string, { fr: string; en: string }> = {
    CA: { fr: "Fédéral",                    en: "Federal"                   },
    QC: { fr: "Québec",                     en: "Quebec"                    },
    ON: { fr: "Ontario",                    en: "Ontario"                   },
    AB: { fr: "Alberta",                    en: "Alberta"                   },
    BC: { fr: "Colombie-Britannique",       en: "British Columbia"          },
    SK: { fr: "Saskatchewan",              en: "Saskatchewan"             },
    MB: { fr: "Manitoba",                   en: "Manitoba"                  },
    NB: { fr: "Nouveau-Brunswick",          en: "New Brunswick"             },
    NS: { fr: "Nouvelle-Écosse",            en: "Nova Scotia"               },
    PE: { fr: "Île-du-Prince-Édouard",      en: "Prince Edward Island"      },
    NL: { fr: "Terre-Neuve-et-Labrador",   en: "Newfoundland and Labrador" },
    NT: { fr: "Territoires du Nord-Ouest", en: "Northwest Territories"     },
    NU: { fr: "Nunavut",                    en: "Nunavut"                   },
    YT: { fr: "Yukon",                      en: "Yukon"                     },
  };
  return {
    nameFr: NAMES[province]?.fr ?? province,
    nameEn: NAMES[province]?.en ?? province,
    bpaCents: r.provincialBasicPersonalCents,
    brackets: r.provincialBrackets.length,
    hasSurtax: !!r.provincialSurtax,
    hasOwnAgency: r.hasOwnAgency,
    creditRateBP: r.provincialCreditRate.baseRateBP,
  };
}
