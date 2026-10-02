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
    rules.federalBasicPersonalCents,
    input.credits
  );

  // 6. Calcul provincial
  const provincialCalc =
    rules.provincialBrackets.length > 0
      ? calculateTax(
          taxableIncomeCents,
          rules.provincialBrackets,
          rules.provincialBasicPersonalCents,
          input.credits
        )
      : emptyTaxCalc();

  // 7. Balances (négatif = remboursement, positif = montant dû)
  const federalBalanceCents =
    federalCalc.taxPayableCents - input.taxWithheldFederalCents;
  const provincialBalanceCents =
    provincialCalc.taxPayableCents - input.taxWithheldProvincialCents;
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

    provincialTaxBeforeCreditsCents: provincialCalc.taxBeforeCreditsCents,
    provincialBasicPersonalCreditCents: provincialCalc.basicPersonalCreditCents,
    provincialOtherCreditsCents: provincialCalc.otherCreditsCents,
    provincialTaxPayableCents: provincialCalc.taxPayableCents,
    provincialTaxWithheldCents: input.taxWithheldProvincialCents,
    provincialBalanceCents,

    totalBalanceCents,

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
        },
        ...(rules.provincialBrackets.length > 0
          ? [
              {
                name: "Montant personnel de base (provincial)",
                amountCents: provincialCalc.basicPersonalCreditCents,
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
}

function calculateTax(
  taxableIncomeCents: number,
  brackets: TaxBracket[],
  basicPersonalCents: number,
  credits: TaxEngineInput["credits"]
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
  const otherCreditsCents = sumCents(
    credits.map((c) =>
      Math.floor((c.claimedAmountCents * lowestRate) / 10000)
    )
  );

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
  };
}

function emptyTaxCalc(): TaxLevelResult {
  return {
    taxBeforeCreditsCents: 0,
    basicPersonalCreditCents: 0,
    otherCreditsCents: 0,
    taxPayableCents: 0,
    bracketApplication: [],
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
