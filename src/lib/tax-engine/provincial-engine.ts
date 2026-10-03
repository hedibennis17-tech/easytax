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
  // RPC — Régime de pensions du Canada
  // ⚠️ Taux TOTAL = 5,95% (composante de base 4,95% + bonification 1,00%)
  // Le T4032 affiche parfois 4,95% qui est la composante de base seulement
  RPC_RATE:              0.0595,   // 5,95%
  RPC_MAX_PENSIONABLE:   7_140_00, // 71 400,00$ en cents
  RPC_EXEMPTION:           350_00, // 3 500,00$ en cents
  RPC_MAX_CONTRIBUTION:  4_034_10, // 4 034,10$ en cents
  RPC2_RATE:             0.0400,   // RPC2 : 4,00% sur tranche 73 200$–81 200$
  RPC2_MAX:               320_00,  // 320,00$ en cents max

  // AE — Assurance-emploi
  AE_RATE:               0.01664,  // 1,664%
  AE_MAX_INSURABLE:     65_700_00, // 65 700,00$ en cents
  AE_MAX_PREMIUM:        1_077_48, // 1 077,48$ en cents

  // RRQ — Québec seulement (taux supérieur au RPC)
  RRQ_RATE:              0.0640,   // 6,40%
  RRQ_MAX_PENSIONABLE:   68_500_00,// 68 500,00$ en cents
  RRQ_EXEMPTION:           350_00,
  RRQ_MAX_CONTRIBUTION:  4_160_00, // 4 160,00$ en cents

  // RQAP — Québec seulement
  RQAP_RATE_EMPLOYEE:    0.00494,  // 0,494%
  RQAP_MAX_INSURABLE:    97_000_00,// 97 000,00$ en cents
  RQAP_MAX_PREMIUM:        479_68, // 479,68$ en cents

  // Abattement fédéral — Québec 16,5%
  QC_FEDERAL_ABATEMENT_RATE: 0.165,

  // Ligne 34990 — crédit compensatoire fédéral 2025
  // Taux effectif = 14,5% sur les crédits + (A − 8 319,38$) × 3,45%
  // A = montant de l'impôt fédéral de base avant crédits
  LINE_34990_BASE_RATE:  0.145,    // 14,5%
  LINE_34990_THRESHOLD:  8_319_38, // 8 319,38$ en cents
  LINE_34990_SUPP_RATE:  0.0345,   // 3,45% supplémentaire

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
      CONSTANTS_2025.RRQ_MAX_PENSIONABLE - CONSTANTS_2025.RRQ_EXEMPTION
    );
    const employee = Math.min(
      Math.round(pensionable * CONSTANTS_2025.RRQ_RATE),
      CONSTANTS_2025.RRQ_MAX_CONTRIBUTION
    );
    return { employeeCents: employee, selfEmployedCents: employee * 2 };
  } else {
    const pensionable = Math.min(
      Math.max(0, employmentIncomeCents - CONSTANTS_2025.RPC_EXEMPTION),
      CONSTANTS_2025.RPC_MAX_PENSIONABLE - CONSTANTS_2025.RPC_EXEMPTION
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
    provincialTaxBeforeCreditsCents: provTaxBase,
    provincialSurtaxCents,
    provincialBasicPersonalCreditCents: provBPACredit,
    provincialOtherCreditsCents: 0,
    provincialRefundableCreditsCents: refundableCreditsCents,
    provincialTaxPayableCents: provTaxPayable,
    provincialTaxWithheldCents: provWithheld,
    provincialBalanceCents,
    totalBalanceCents,
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
