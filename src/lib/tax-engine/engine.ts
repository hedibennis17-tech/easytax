// ═══════════════════════════════════════════════════════════════
// TAX ENGINE — Moteur central de calcul fiscal
//
// RÈGLE ABSOLUE :
//   - Toutes les valeurs monétaires sont en CENTS (integer)
//   - Jamais de float pour l'argent
//   - Seules les données VALIDÉES entrent dans le moteur
//   - Le résultat est PRÉLIMINAIRE — pas une déclaration officielle
// ═══════════════════════════════════════════════════════════════

import type {
  TaxEngineInput,
  TaxCalculationResult,
  TaxBracket,
  BracketApplication,
  TaxRulesForYear,
} from "./types";
import { getRulesForYearAndProvince } from "./rules/2025";

// ─── FONCTION PRINCIPALE ─────────────────────────────────────────────────────

export function calculate(input: TaxEngineInput): TaxCalculationResult {
  const rules = getRulesForYearAndProvince(input.taxYear, input.province);

  if (!rules) {
    throw new Error(
      `Règles fiscales non disponibles pour ${input.province} / ${input.taxYear}`
    );
  }

  // 1. Calcul des revenus totaux (cents uniquement)
  const totalIncomeCents = sumCents(input.incomes.map((i) => i.amountCents));

  // 2. Calcul des déductions totales
  const totalDeductionsCents = sumCents(
    input.deductions.map((d) => d.amountCents)
  );

  // 3. Revenu net
  const netIncomeCents = Math.max(0, totalIncomeCents - totalDeductionsCents);

  // 4. Revenu imposable (simplification étape 4 — ajustements supplémentaires à l'étape 5)
  const taxableIncomeCents = netIncomeCents;

  // 5. Calcul fédéral
  const federalCalc = calculateTax(
    taxableIncomeCents,
    rules.federalBrackets,
    rules.federalBasicPersonalConfig?.fullAmountCents ?? rules.federalBasicPersonalCents,
    input.credits,
    "CA"
  );

  // 6. Calcul provincial
  const provincialCalc =
    rules.provincialBrackets.length > 0
      ? calculateTax(
          taxableIncomeCents,
          rules.provincialBrackets,
          rules.provincialBasicPersonalConfig?.fullAmountCents ?? rules.provincialBasicPersonalCents,
          input.credits,
          input.province
        )
      : emptyTaxCalc();

  // ─── RÈGLEMENT FÉDÉRAL (spec easytax-tax-engine-spec-2025-qc) ─────────────
  //
  //  43500 = total à payer (impôt fédéral net après crédits non remboursables)
  //  43700 = impôt DÉJÀ RETENU à la source (T4 box22 + autres feuillets)
  //  45300 = ACT / CWB (prestation remboursable fédérale)
  //  48200 = 43700 + 45300 + autres crédits remboursables
  //  48400 = MAX(0, 48200 - 43500) → REMBOURSEMENT
  //  48500 = MAX(0, 43500 - 48200) → SOLDE À PAYER
  //
  //  INTERDIT : if taxPayable == 0 then refund = 0
  //  Un impôt net à 0 et un remboursement positif sont VALIDES.
  // ─────────────────────────────────────────────────────────────────────────────

  // CWB (ACT) = crédits remboursables marqués comme tels dans les inputs
  // (calculé par la couche appelante selon 5005-S6 QC ou formule fédérale)
  const cwbCents = federalCalc.refundableCreditsCents;

  // Ligne 43500 = impôt fédéral net (après non-remboursables, plancher 0)
  const line43500Cents = federalCalc.taxPayableCents;

  // Ligne 43700 = retenues à la source de tous les feuillets applicables
  const line43700Cents = input.taxWithheldFederalCents;

  // Ligne 45300 = ACT/CWB (remboursable) — séparé de 43700
  const line45300Cents = cwbCents;

  // Ligne 48200 = total des crédits utilisés dans le règlement
  // = retenues (43700) + ACT (45300) + autres crédits remboursables
  const line48200Cents = line43700Cents + cwbCents;

  // Ligne 48400 = remboursement = MAX(0, 48200 - 43500)
  const line48400Cents = Math.max(0, line48200Cents - line43500Cents);

  // Ligne 48500 = solde à payer = MAX(0, 43500 - 48200)
  const line48500Cents = Math.max(0, line43500Cents - line48200Cents);

  const federalSettlementStatus: "REFUND" | "BALANCE_OWING" | "ZERO" =
    line48400Cents > 0 ? "REFUND"
    : line48500Cents > 0 ? "BALANCE_OWING"
    : "ZERO";

  // federalBalanceCents: négatif = remboursement, positif = dû (pour rétrocompat)
  const federalBalanceCents = line48500Cents > 0 ? line48500Cents : -line48400Cents;

  const provincialBalanceCents =
    provincialCalc.taxPayableCents - input.taxWithheldProvincialCents - provincialCalc.refundableCreditsCents;
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

    federalTaxBeforeCreditsCents: federalCalc.taxBeforeCreditsCents,
    federalBasicPersonalCreditCents: federalCalc.basicPersonalCreditCents,
    federalOtherCreditsCents: federalCalc.otherCreditsCents,
    federalTaxPayableCents: federalCalc.taxPayableCents,
    federalTaxWithheldCents: input.taxWithheldFederalCents,
    federalBalanceCents,
    federalRefundableCreditsCents: federalCalc.refundableCreditsCents,

    // Settlement fédéral explicite
    federalLine43500Cents: line43500Cents,
    federalLine43700Cents: line43700Cents,
    federalLine45300Cents: line45300Cents,
    federalLine48200Cents: line48200Cents,
    federalLine48400Cents: line48400Cents,
    federalLine48500Cents: line48500Cents,
    federalSettlementStatus,

    provincialSurtaxCents: 0,
    provincialRefundableCreditsCents: provincialCalc.refundableCreditsCents,
    provincialTaxBeforeCreditsCents: provincialCalc.taxBeforeCreditsCents,
    provincialBasicPersonalCreditCents: provincialCalc.basicPersonalCreditCents,
    provincialOtherCreditsCents: provincialCalc.otherCreditsCents,
    provincialTaxPayableCents: provincialCalc.taxPayableCents,
    provincialTaxWithheldCents: input.taxWithheldProvincialCents,
    provincialBalanceCents,

    totalBalanceCents,
    lines: {
      "15000": totalIncomeCents,
      "23600": netIncomeCents,
      "26000": taxableIncomeCents,
      "35000": federalCalc.basicPersonalCreditCents + federalCalc.otherCreditsCents,
      "42000": federalCalc.taxPayableCents,
      "43500": line43500Cents,
      "43700": line43700Cents,
      "45300": line45300Cents,
      "48200": line48200Cents,
      "48400": line48400Cents,
      "48500": line48500Cents,
    },

    breakdown: {
      incomeByCategory: input.incomes.map((i) => ({
        category: i.category,
        amountCents: i.amountCents,
      })),
      deductionByCategory: input.deductions.map((d) => ({
        category: d.category,
        amountCents: d.amountCents,
      })),
      federalBracketApplication: federalCalc.bracketApplication,
      provincialBracketApplication: provincialCalc.bracketApplication,
      creditsApplied: [
        {
          name: "Montant personnel de base (fédéral)",
          amountCents: federalCalc.basicPersonalCreditCents,
          isRefundable: false,
        },
        ...input.credits.filter(c => c.isRefundable).map(c => ({
          name: c.description ?? c.category,
          amountCents: c.claimedAmountCents,
          isRefundable: true,
        })),
        ...(rules.provincialBrackets.length > 0
          ? [
              {
                name: "Montant personnel de base (provincial)",
                amountCents: provincialCalc.basicPersonalCreditCents,
                isRefundable: false,
              },
            ]
          : []),
      ],
    },
  };
}

// ─── CALCUL D'UN NIVEAU D'IMPOSITION ─────────────────────────────────────────

interface TaxLevelResult {
  taxBeforeCreditsCents: number;
  basicPersonalCreditCents: number;
  otherCreditsCents: number;
  taxPayableCents: number;
  bracketApplication: BracketApplication[];
  refundableCreditsCents: number;
}

function calculateTax(
  taxableIncomeCents: number,
  brackets: TaxBracket[],
  basicPersonalCents: number,
  credits: TaxEngineInput["credits"],
  jurisdiction: TaxEngineInput["province"] | "CA"
): TaxLevelResult {
  // Application des paliers d'imposition
  let remaining = taxableIncomeCents;
  let taxBeforeCreditsCents = 0;
  const bracketApplication: BracketApplication[] = [];

  for (const bracket of brackets) {
    if (remaining <= 0) break;

    const bracketMax = bracket.maxCents ?? Infinity;
    const bracketWidth = bracketMax - bracket.minCents;
    const incomeInBracket = Math.min(remaining, bracketWidth);

    // Calcul entier — multiplication puis division, jamais de float intermédiaire
    const taxInBracket = Math.floor(
      (incomeInBracket * bracket.rateBasisPoints) / 10000
    );

    taxBeforeCreditsCents += taxInBracket;
    remaining -= incomeInBracket;

    bracketApplication.push({
      label: `Palier ${formatCents(bracket.minCents)}–${bracket.maxCents ? formatCents(bracket.maxCents) : "∞"} (${(bracket.rateBasisPoints / 100).toFixed(2)}%)`,
      incomeCents: incomeInBracket,
      rateBasisPoints: bracket.rateBasisPoints,
      taxCents: taxInBracket,
    });
  }

  // Crédit personnel de base — toujours appliqué au taux du premier palier
  const lowestRate = brackets[0]?.rateBasisPoints ?? 1500;
  const basicPersonalCreditCents = Math.floor(
    (basicPersonalCents * lowestRate) / 10000
  );

  // Autres crédits (non remboursables) — montant réclamé × taux minimum
  const applicableCredits = credits.filter(c => !c.jurisdiction || c.jurisdiction === jurisdiction || (jurisdiction === "CA" && c.jurisdiction === "CA"));
  const otherCreditsCents = sumCents(
    applicableCredits.filter(c => !c.isRefundable).map((c) =>
      Math.floor((c.claimedAmountCents * lowestRate) / 10000)
    )
  );
  const refundableCreditsCents = sumCents(applicableCredits.filter(c => c.isRefundable).map(c => c.claimedAmountCents));

  const totalCreditsCents = basicPersonalCreditCents + otherCreditsCents;
  const taxPayableCents = Math.max(
    0,
    taxBeforeCreditsCents - totalCreditsCents
  );

  return {
    taxBeforeCreditsCents,
    basicPersonalCreditCents,
    otherCreditsCents,
    taxPayableCents,
    bracketApplication,
    refundableCreditsCents,
  };
}

function emptyTaxCalc(): TaxLevelResult {
  return {
    taxBeforeCreditsCents: 0,
    basicPersonalCreditCents: 0,
    otherCreditsCents: 0,
    taxPayableCents: 0,
    bracketApplication: [],
    refundableCreditsCents: 0,
  };
}

// ─── UTILITAIRES MONÉTAIRES ───────────────────────────────────────────────────

// Addition en cents — jamais de float
function sumCents(amounts: number[]): number {
  return amounts.reduce((acc, v) => acc + Math.round(v), 0);
}

// Formater des cents en dollars lisibles (pour breakdown)
export function formatCents(cents: number): string {
  const dollars = Math.abs(Math.floor(cents / 100));
  const centsPart = Math.abs(cents % 100);
  return `${dollars.toLocaleString("fr-CA")},${centsPart.toString().padStart(2, "0")} $`;
}

// Formater un solde (remboursement ou montant dû)
export function formatBalance(cents: number): {
  amount: string;
  isRefund: boolean;
  label: string;
} {
  const isRefund = cents < 0;
  return {
    amount: formatCents(Math.abs(cents)),
    isRefund,
    label: isRefund ? "Remboursement estimé" : "Montant estimé à payer",
  };
}
