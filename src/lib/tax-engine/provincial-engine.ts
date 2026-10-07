// ═══════════════════════════════════════════════════════════════
// PROVINCIAL ENGINE — Moteur de calcul fiscal complet 2025
// Sources: ARC T4032 2025, Revenu Québec, budgets provinciaux
// ⚠️ Calculs PRÉLIMINAIRES — non certifiés NETFILE
// ═══════════════════════════════════════════════════════════════

import { getRulesForYearAndProvince } from "./rules/2025";
import type {
  TaxEngineInput,
  TaxCalculationResult,
  TaxBracket,
  BracketApplication,
} from "./types";

// ─── CONSTANTES 2025 VÉRIFIÉES ───────────────────────────────
export const CONSTANTS_2025 = {
  // ── RPC — Régime de pensions du Canada ───────────────────────
  // Source: credits-federal-2025.json (cpp)
  // ⚠️ 5,95% = taux TOTAL (4,95% base + 1,00% 1re bonification)
  // Ne JAMAIS coder 4,95% seul — c'est seulement la composante de base
  RPC_RATE:              0.0595,   // 5,95% employé
  RPC_RATE_SELF:         0.1190,   // 11,90% travailleur autonome
  RPC_YMPE:              7_130_000, // YMPE 71 300$ en cents
  RPC_EXEMPTION:           350_000, // 3 500$ en cents
  RPC_MAX_CONTRIBUTION:  4_034_10, // 4 034,10$ en cents (employé)
  // RPC2 — 2e bonification (sur tranche 71 300$–81 200$)
  RPC2_RATE:             0.0400,   // 4,00%
  RPC2_YAMPE:            8_120_000, // YAMPE 81 200$ en cents
  RPC2_MAX_EMPLOYEE:       396_00,  // 396,00$ en cents max

  // ── AE — Assurance-emploi ─────────────────────────────────────
  // Source: credits-federal-2025.json (ei)
  AE_RATE:               0.0164,   // 1,64%
  AE_RATE_QC:            0.0131,   // 1,31% QC (réduit car RQAP)
  AE_MAX_INSURABLE:     65_700_00, // 65 700$ en cents
  AE_MAX_PREMIUM:        1_077_48, // 1 077,48$ en cents
  AE_MAX_PREMIUM_QC:       860_67, // 860,67$ en cents (QC)

  // ── RRQ — Québec seulement ────────────────────────────────────
  // Source: provincial/QC.json (qppRRQ)
  // RRQ = 6,40% = 5,40% base + 1,00% supplémentaire
  // ⚠️ Contributions SUPPLÉMENTAIRES = déduction (pas crédit)
  RRQ_RATE_EMPLOYEE:     0.0640,   // 6,40% total
  RRQ_RATE_SELF:         0.1280,   // 12,80% travailleur autonome
  RRQ_YMPE:              7_130_000, // 71 300$ en cents
  RRQ_EXEMPTION:           350_000,
  RRQ_MAX_T1:            4_339_20, // 4 339,20$ (tier 1 max)
  // RRQ 2e palier (sur tranche 71 300$–81 200$)
  RRQ2_RATE:             0.0400,
  RRQ2_YAMPE:            8_120_000,
  RRQ2_MAX:                396_00,
  RRQ_TOTAL_MAX:         4_735_20, // 4 735,20$ total employé

  // ── RQAP — Québec seulement ───────────────────────────────────
  // Source: provincial/QC.json (qpipRQAP)
  RQAP_RATE_EMPLOYEE:    0.00494,  // 0,494%
  RQAP_RATE_SELF:        0.00878,  // 0,878%
  RQAP_MAX_INSURABLE:    98_000_00,// 98 000$ en cents
  RQAP_MAX_EMPLOYEE:       484_12, // 484,12$ en cents

  // ── Abattement fédéral QC ────────────────────────────────────
  QC_FEDERAL_ABATEMENT_RATE: 0.165, // 16,5% — remboursable

  // ── Ligne 34990 — crédit compensatoire fédéral 2025 ──────────
  // Source: credits-federal-2025.json (topUpCredit34990) + rules-2025.json
  // Loi C-4 (sanction royale 2026-03-12)
  // Formule: (A - B×C) × D  où B=14,5%, C=57 375$, D=3,45%
  // A = total des bases de crédits non remboursables admissibles
  // Seuil: 8 319,38$ = 57 375 × 14,5%
  LINE_34990_BASE_RATE:  0.145,    // 14,5% — taux de base crédits NR
  LINE_34990_THRESHOLD:  8_319_38, // 8 319,38$ en cents
  LINE_34990_SUPP_RATE:  0.0345,   // 3,45% sur l'excédent

  // BPA fédéral 2025
  BPA_FEDERAL_FULL:     16_129_00, // 16 129,00$ en cents
  BPA_FEDERAL_MIN:      14_538_00, // 14 538,00$ (revenu > 253 414$)
  BPA_PHASE_OUT_START: 177_882_00,
  BPA_PHASE_OUT_END:   253_414_00,

  // Prime santé Ontario
  ON_HEALTH_PREMIUM_THRESHOLDS: [
    { maxIncome:  20_000_00, premium: 0         },
    { maxIncome:  36_000_00, premium: 300_00    },
    { maxIncome:  48_000_00, premium: 450_00    },
    { maxIncome:  72_000_00, premium: 600_00    },
    { maxIncome:  200_000_00,premium: 750_00    },
    { maxIncome:  null,       premium: 900_00   },
  ],

  // LIFT Ontario (Low-income individuals and families tax credit)
  ON_LIFT_MAX:            875_00,  // 875$ max
  ON_LIFT_INCOME_MAX:  50_000_00,  // ~50 000$ revenu net

  // FSS Québec (Fonds de services de santé)
  QC_FSS_RATE:           0.0100,   // 1,0% (travailleur autonome)
  QC_FSS_MAX:            1_000_00, // 1 000$ max

  // Prime assurance médicaments QC 2025
  QC_MED_PREMIUM_MAX:      716_00, // 716$ max annuel
  QC_MED_PHASE_OUT_START: 16_295_00,
  QC_MED_PHASE_OUT_END:   44_060_00,
} as const;

// ─── CALCUL DES PALIERS ───────────────────────────────────────
export function calculateBracketTax(
  incomeCents: number,
  brackets: TaxBracket[]
): { taxCents: number; breakdown: BracketApplication[] } {
  let taxCents = 0;
  const breakdown: BracketApplication[] = [];

  for (const bracket of brackets) {
    if (incomeCents <= bracket.minCents) break;
    const bracketMax = bracket.maxCents ?? Infinity;
    const taxableInBracket = Math.min(incomeCents, bracketMax) - bracket.minCents;
    if (taxableInBracket <= 0) continue;
    const bracketTax = Math.round((taxableInBracket * bracket.rateBasisPoints) / 10000);
    taxCents += bracketTax;
    breakdown.push({
      label: `${(bracket.rateBasisPoints / 100).toFixed(2)}% sur ${(taxableInBracket / 100).toFixed(2)}$`,
      incomeCents: taxableInBracket,
      rateBasisPoints: bracket.rateBasisPoints,
      taxCents: bracketTax,
    });
  }
  return { taxCents, breakdown };
}

// ─── BPA AVEC ÉLIMINATION PROGRESSIVE ────────────────────────
export function calculateBPA(
  incomeCents: number,
  fullAmountCents: number,
  minAmountCents?: number,
  phaseOutStartCents?: number,
  phaseOutEndCents?: number,
): number {
  if (!minAmountCents || !phaseOutStartCents || !phaseOutEndCents) {
    return fullAmountCents;
  }
  if (incomeCents <= phaseOutStartCents) return fullAmountCents;
  if (incomeCents >= phaseOutEndCents) return minAmountCents;
  const ratio = (incomeCents - phaseOutStartCents) / (phaseOutEndCents - phaseOutStartCents);
  return Math.round(fullAmountCents - ratio * (fullAmountCents - minAmountCents));
}

// ─── SURTAXE ONTARIO ─────────────────────────────────────────
export function calculateONSurtax(basicProvincialTaxCents: number): number {
  // Seuils 2025 corrigés: 5 710$ et 7 307$
  const t1 = CONSTANTS_2025.ON_LIFT_MAX; // placeholder — voir surtaxe
  let surtax = 0;
  if (basicProvincialTaxCents > 5_710_00) {
    surtax += Math.round((basicProvincialTaxCents - 5_710_00) * 0.20);
  }
  if (basicProvincialTaxCents > 7_307_00) {
    surtax += Math.round((basicProvincialTaxCents - 7_307_00) * 0.36);
  }
  return surtax;
}

// ─── ABATTEMENT QUÉBEC ────────────────────────────────────────
export function calculateQCAbatement(federalTaxBeforeAbatementCents: number): number {
  // 16,5% de l'impôt fédéral de base — réduit l'impôt fédéral pour les Québécois
  return Math.round(federalTaxBeforeAbatementCents * CONSTANTS_2025.QC_FEDERAL_ABATEMENT_RATE);
}

// ─── PRIME SANTÉ ONTARIO ─────────────────────────────────────
export function calculateONHealthPremium(netIncomeCents: number): number {
  for (const tier of CONSTANTS_2025.ON_HEALTH_PREMIUM_THRESHOLDS) {
    if (tier.maxIncome === null || netIncomeCents <= tier.maxIncome) {
      return tier.premium;
    }
  }
  return 900_00;
}

// ─── COTISATIONS RPC/RRQ ─────────────────────────────────────
export function calculatePensionContribution(
  employmentIncomeCents: number,
  isQC: boolean
): { employeeCents: number; selfEmployedCents: number } {
  if (isQC) {
    const pensionable = Math.min(
      Math.max(0, employmentIncomeCents - CONSTANTS_2025.RRQ_EXEMPTION),
      CONSTANTS_2025.RRQ_YMPE - CONSTANTS_2025.RRQ_EXEMPTION
    );
    const employee = Math.min(
      Math.round(pensionable * CONSTANTS_2025.RRQ_RATE_EMPLOYEE),
      CONSTANTS_2025.RRQ_MAX_T1
    );
    return { employeeCents: employee, selfEmployedCents: employee * 2 };
  } else {
    const pensionable = Math.min(
      Math.max(0, employmentIncomeCents - CONSTANTS_2025.RPC_EXEMPTION),
      CONSTANTS_2025.RPC_YMPE - CONSTANTS_2025.RPC_EXEMPTION
    );
    const employee = Math.min(
      Math.round(pensionable * CONSTANTS_2025.RPC_RATE),
      CONSTANTS_2025.RPC_MAX_CONTRIBUTION
    );
    return { employeeCents: employee, selfEmployedCents: employee * 2 };
  }
}

// ─── CALCUL PRINCIPAL ─────────────────────────────────────────
export function calculateProvincialTax(input: TaxEngineInput): TaxCalculationResult {
  const rules = getRulesForYearAndProvince(input.taxYear, input.province);
  if (!rules) throw new Error(`Règles non trouvées: ${input.taxYear}_${input.province}`);

  const isQC = input.province === "QC";

  // 1. REVENU TOTAL
  const totalIncomeCents = input.incomes.reduce((s, i) => s + i.amountCents, 0);

  // 2. DÉDUCTIONS
  const totalDeductionsCents = input.deductions.reduce((s, d) => s + d.amountCents, 0);

  // 3. REVENU NET
  const netIncomeCents = Math.max(0, totalIncomeCents - totalDeductionsCents);

  // 4. REVENU IMPOSABLE (= revenu net pour l'instant)
  const taxableIncomeCents = netIncomeCents;

  // 5. BPA fédéral avec élimination progressive
  const federalBPACents = calculateBPA(
    netIncomeCents,
    rules.federalBasicPersonalConfig.fullAmountCents,
    rules.federalBasicPersonalConfig.minAmountCents,
    rules.federalBasicPersonalConfig.phaseOutStartCents,
    rules.federalBasicPersonalConfig.phaseOutEndCents,
  );

  // 6. BPA provincial avec élimination progressive
  const provincialBPACents = calculateBPA(
    netIncomeCents,
    rules.provincialBasicPersonalConfig.fullAmountCents,
    rules.provincialBasicPersonalConfig.minAmountCents,
    rules.provincialBasicPersonalConfig.phaseOutStartCents,
    rules.provincialBasicPersonalConfig.phaseOutEndCents,
  );

  // 7. IMPÔT FÉDÉRAL DE BASE
  const { taxCents: fedTaxBase, breakdown: fedBracketBD } =
    calculateBracketTax(taxableIncomeCents, rules.federalBrackets);

  // 8. CRÉDIT PERSONNEL DE BASE FÉDÉRAL (ligne 34990 — taux 14,5%)
  const fedBPACredit = Math.round(federalBPACents * CONSTANTS_2025.LINE_34990_BASE_RATE);

  // 9. CRÉDIT COMPENSATOIRE SUPPLÉMENTAIRE (si impôt > 8 319,38$)
  const fedSupplementalCredit = fedTaxBase > CONSTANTS_2025.LINE_34990_THRESHOLD
    ? Math.round((fedTaxBase - CONSTANTS_2025.LINE_34990_THRESHOLD) * CONSTANTS_2025.LINE_34990_SUPP_RATE)
    : 0;

  // 10. AUTRES CRÉDITS FÉDÉRAUX
  const fedOtherCredits = input.credits.reduce((s, c) => s + c.claimedAmountCents, 0);

  // 11. IMPÔT FÉDÉRAL NET
  let fedTaxPayable = Math.max(0,
    fedTaxBase - fedBPACredit - fedSupplementalCredit - fedOtherCredits
  );

  // 12. ABATTEMENT QC (−16,5% de l'impôt fédéral)
  let federalAbatement = 0;
  if (isQC) {
    federalAbatement = calculateQCAbatement(fedTaxPayable);
    fedTaxPayable = Math.max(0, fedTaxPayable - federalAbatement);
  }

  // 13. IMPÔT PROVINCIAL DE BASE
  const { taxCents: provTaxBase, breakdown: provBracketBD } =
    calculateBracketTax(taxableIncomeCents, rules.provincialBrackets);

  // 14. CRÉDIT PERSONNEL DE BASE PROVINCIAL
  const provCreditRate = rules.provincialCreditRate.baseRateBP;
  const provBPACredit = Math.round(provincialBPACents * provCreditRate / 10000);

  // 15. SURTAXE ONTARIENNE
  const provincialSurtaxCents = input.province === "ON"
    ? calculateONSurtax(provTaxBase)
    : 0;

  // 16. PRIME SANTÉ ONTARIO (déduite du remboursement)
  const onHealthPremium = input.province === "ON"
    ? calculateONHealthPremium(netIncomeCents)
    : 0;

  // 17. CRÉDITS PROVINCIAUX REMBOURSABLES
  const refundableCreditsCents = 0; // À implémenter par province

  // 18. IMPÔT PROVINCIAL NET
  const provTaxPayable = Math.max(0,
    provTaxBase + provincialSurtaxCents + onHealthPremium - provBPACredit
  );

  // 19. RETENUES
  const fedWithheld = input.taxWithheldFederalCents;
  const provWithheld = input.taxWithheldProvincialCents;

  // 20. SOLDES (négatif = remboursement)
  const federalBalanceCents = fedTaxPayable - fedWithheld;
  const provincialBalanceCents = provTaxPayable - provWithheld;
  const totalBalanceCents = federalBalanceCents + provincialBalanceCents;

  return {
    taxYear: input.taxYear,
    province: input.province,
    isPreliminary: true,
    rulesVersion: rules.rulesVersion,
    totalIncomeCents,
    totalDeductionsCents,
    netIncomeCents,
    taxableIncomeCents,
    federalTaxBeforeCreditsCents: fedTaxBase,
    federalBasicPersonalCreditCents: fedBPACredit + fedSupplementalCredit,
    federalOtherCreditsCents: fedOtherCredits,
    federalTaxPayableCents: fedTaxPayable,
    federalTaxWithheldCents: fedWithheld,
    federalBalanceCents,
    federalRefundableCreditsCents: 0,
    provincialTaxBeforeCreditsCents: provTaxBase,
    provincialSurtaxCents,
    provincialBasicPersonalCreditCents: provBPACredit,
    provincialOtherCreditsCents: 0,
    provincialRefundableCreditsCents: refundableCreditsCents,
    provincialTaxPayableCents: provTaxPayable,
    provincialTaxWithheldCents: provWithheld,
    provincialBalanceCents,
    totalBalanceCents,
    lines: {
      "15000": totalIncomeCents,
      "23600": netIncomeCents,
      "26000": taxableIncomeCents,
      "35000": fedBPACredit + fedSupplementalCredit + fedOtherCredits,
      "42000": fedTaxPayable,
      "43500": fedTaxPayable,
      "43700": fedWithheld,
      "48200": fedWithheld,
    },
    breakdown: {
      incomeByCategory: input.incomes.map(i => ({ category: i.category, amountCents: i.amountCents })),
      deductionByCategory: input.deductions.map(d => ({ category: d.category, amountCents: d.amountCents })),
      federalBracketApplication: fedBracketBD,
      provincialBracketApplication: provBracketBD,
      creditsApplied: [
        { name: "Montant personnel de base fédéral", amountCents: fedBPACredit, isRefundable: false },
        { name: "Crédit compensatoire ligne 34990", amountCents: fedSupplementalCredit, isRefundable: false },
        ...(isQC ? [{ name: "Abattement fédéral QC 16,5%", amountCents: federalAbatement, isRefundable: false }] : []),
        { name: "Montant personnel de base provincial", amountCents: provBPACredit, isRefundable: false },
        ...(provincialSurtaxCents > 0 ? [{ name: "Surtaxe Ontario", amountCents: -provincialSurtaxCents, isRefundable: false }] : []),
      ],
    },
  };
}
