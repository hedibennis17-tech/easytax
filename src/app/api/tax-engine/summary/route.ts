import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxCalculations, incomeEntries, deductionEntries } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { formatCents, formatBalance } from "@/lib/tax-engine/engine";

// GET /api/tax-engine/summary?taxReturnId=xxx
export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const taxReturnId = req.nextUrl.searchParams.get("taxReturnId");
  if (!taxReturnId) return NextResponse.json({ error: "taxReturnId requis" }, { status: 400 });

  // Dernier calcul disponible
  const [calc] = await db.select().from(taxCalculations)
    .where(and(eq(taxCalculations.userId, clerkUserId), eq(taxCalculations.taxReturnId, taxReturnId)))
    .orderBy(desc(taxCalculations.calculatedAt))
    .limit(1);

  // Stats revenus
  const incomes = await db.select().from(incomeEntries)
    .where(and(eq(incomeEntries.userId, clerkUserId), eq(incomeEntries.taxReturnId, taxReturnId)));

  const deductions = await db.select().from(deductionEntries)
    .where(and(eq(deductionEntries.userId, clerkUserId), eq(deductionEntries.taxReturnId, taxReturnId)));

  const totalIncomeCents = incomes.reduce((s, i) => s + (i.amountCents ?? 0), 0);
  const totalDeductionsCents = deductions.reduce((s, d) => s + (d.amountCents ?? 0), 0);
  const validatedIncomes = incomes.filter((i) => i.isValidated).length;

  if (!calc) {
    return NextResponse.json({
      hasCalculation: false,
      incomeCount: incomes.length,
      validatedIncomeCount: validatedIncomes,
      totalIncomeCents,
      totalIncome: formatCents(totalIncomeCents),
      totalDeductionsCents,
      totalDeductions: formatCents(totalDeductionsCents),
    });
  }

  const balanceFederal = formatBalance(calc.federalBalanceCents ?? 0);
  const balanceProvincial = formatBalance(calc.provincialBalanceCents ?? 0);
  const balanceTotal = formatBalance(calc.totalBalanceCents ?? 0);

  // Lire les lignes de règlement stockées dans calculationDetails
  let settlement: Record<string, number | string> = {};
  try {
    const details = typeof calc.calculationDetails === "string"
      ? JSON.parse(calc.calculationDetails)
      : calc.calculationDetails;
    if (details?.settlement) settlement = details.settlement as Record<string, number | string>;
  } catch { /* no-op */ }

  const line43500 = (settlement.line43500 as number) ?? (calc.federalTaxPayableCents ?? 0);
  const line43700 = (settlement.line43700 as number) ?? (calc.federalTaxWithheldCents ?? 0);
  const line45300 = (settlement.line45300 as number) ?? (calc.federalRefundableCreditsCents ?? 0);
  const line48200 = (settlement.line48200 as number) ?? (line43700 + line45300);
  const line48400 = (settlement.line48400 as number) ?? Math.max(0, line48200 - line43500);
  const line48500 = (settlement.line48500 as number) ?? Math.max(0, line43500 - line48200);
  const settlementStatus = (settlement.status as string) ?? (line48400 > 0 ? "REFUND" : line48500 > 0 ? "BALANCE_OWING" : "ZERO");

  return NextResponse.json({
    hasCalculation: true,
    isPreliminary: calc.isPreliminary,
    calculatedAt: calc.calculatedAt,
    rulesVersion: calc.rulesSnapshotVersion,
    totalIncome: formatCents(calc.totalIncomeCents ?? 0),
    totalIncomeCents: calc.totalIncomeCents,
    totalDeductions: formatCents((calc.totalIncomeCents ?? 0) - (calc.netIncomeCents ?? 0)),
    netIncome: formatCents(calc.netIncomeCents ?? 0),
    taxableIncome: formatCents(calc.taxableIncomeCents ?? 0),
    federal: {
      taxBeforeCredits: formatCents(calc.federalTaxBeforeCreditsCents ?? 0),
      credits: formatCents(calc.federalNonRefundableCreditsCents ?? 0),
      taxPayable: formatCents(calc.federalTaxPayableCents ?? 0),
      withheld: formatCents(calc.federalTaxWithheldCents ?? 0),
      balance: balanceFederal,
      // Lignes de règlement fédéral (T1)
      line42000Cents: calc.federalTaxPayableCents ?? 0,
      line43500Cents: line43500,
      line43700Cents: line43700,
      line45300Cents: line45300,
      line48200Cents: line48200,
      line48400Cents: line48400,
      line48500Cents: line48500,
      line42000: formatCents(calc.federalTaxPayableCents ?? 0),
      line43500: formatCents(line43500),
      line43700: formatCents(line43700),
      line45300: formatCents(line45300),
      line48200: formatCents(line48200),
      line48400: formatCents(line48400),
      line48500: formatCents(line48500),
      settlementStatus,
    },
    provincial: {
      taxBeforeCredits: formatCents(calc.provincialTaxBeforeCreditsCents ?? 0),
      credits: formatCents(calc.provincialNonRefundableCreditsCents ?? 0),
      taxPayable: formatCents(calc.provincialTaxPayableCents ?? 0),
      withheld: formatCents(calc.provincialTaxWithheldCents ?? 0),
      balance: balanceProvincial,
    },
    total: balanceTotal,
    warning: "CES RÉSULTATS SONT PRÉLIMINAIRES ET INDICATIFS SEULEMENT. Aucune déclaration n'a été transmise à l'ARC ou à Revenu Québec.",
  });
}
