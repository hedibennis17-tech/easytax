import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxReturns, taxProfiles, taxYears,
  incomeEntries, deductionEntries, creditEntries, taxCalculations,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { calculate } from "@/lib/tax-engine/engine";
import type { TaxEngineInput } from "@/lib/tax-engine/types";

export async function POST(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { taxReturnId } = body;
  if (!taxReturnId) return NextResponse.json({ error: "taxReturnId requis" }, { status: 400 });

  const profile = await db.select({ id: taxProfiles.id, province: taxProfiles.province, fiscalResidence: taxProfiles.fiscalResidence })
    .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile[0]) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const taxReturn = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId })
    .from(taxReturns)
    .where(and(eq(taxReturns.id, taxReturnId), eq(taxReturns.profileId, profile[0].id)))
    .limit(1);
  if (!taxReturn[0]) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

  const taxYear = await db.select({ year: taxYears.year }).from(taxYears)
    .where(eq(taxYears.id, taxReturn[0].taxYearId)).limit(1);
  if (!taxYear[0]) return NextResponse.json({ error: "Année introuvable" }, { status: 404 });

  const year = taxYear[0].year;
  const province = (profile[0].fiscalResidence ?? profile[0].province ?? "QC") as string;

  // DONNÉES VALIDÉES UNIQUEMENT — règle absolue du Tax Engine
  const incomes = await db.select().from(incomeEntries)
    .where(and(eq(incomeEntries.userId, clerkUserId), eq(incomeEntries.taxReturnId, taxReturnId), eq(incomeEntries.isValidated, true)));

  const deductions = await db.select().from(deductionEntries)
    .where(and(eq(deductionEntries.userId, clerkUserId), eq(deductionEntries.taxReturnId, taxReturnId), eq(deductionEntries.isValidated, true)));

  const credits = await db.select().from(creditEntries)
    .where(and(eq(creditEntries.userId, clerkUserId), eq(creditEntries.taxReturnId, taxReturnId), eq(creditEntries.isValidated, true)));

  const input: TaxEngineInput = {
    taxYear: year,
    province: province as "QC" | "ON" | "CA",
    incomes: incomes.map((i) => ({
      category: i.category,
      amountCents: i.amountCents ?? 0,
      sourceType: (i.sourceType as "validated_ocr" | "manual" | "profile"),
      employerName: i.employerName ?? undefined,
      description: i.description ?? undefined,
    })),
    deductions: deductions.map((d) => ({
      category: d.category,
      amountCents: d.amountCents ?? 0,
      sourceType: (d.sourceType as "validated_ocr" | "manual"),
      description: d.description ?? undefined,
    })),
    credits: credits.map((c) => ({
      category: c.category,
      claimedAmountCents: c.claimedAmountCents ?? 0,
      sourceType: (c.sourceType as "validated_ocr" | "manual"),
      description: c.description ?? undefined,
    })),
    taxWithheldFederalCents: body.taxWithheldFederalCents ?? 0,
    taxWithheldProvincialCents: body.taxWithheldProvincialCents ?? 0,
    hasSpouse: body.hasSpouse ?? false,
  };

  try {
    const result = calculate(input);

    const [saved] = await db.insert(taxCalculations).values({
      userId: clerkUserId,
      taxReturnId,
      taxYearId: taxReturn[0].taxYearId,
      status: "completed",
      totalIncomeCents: result.totalIncomeCents,
      netIncomeCents: result.netIncomeCents,
      taxableIncomeCents: result.taxableIncomeCents,
      federalTaxBeforeCreditsCents: result.federalTaxBeforeCreditsCents,
      federalNonRefundableCreditsCents: result.federalBasicPersonalCreditCents + result.federalOtherCreditsCents,
      federalRefundableCreditsCents: 0,
      federalTaxPayableCents: result.federalTaxPayableCents,
      federalTaxWithheldCents: result.federalTaxWithheldCents,
      federalBalanceCents: result.federalBalanceCents,
      provincialTaxBeforeCreditsCents: result.provincialTaxBeforeCreditsCents,
      provincialNonRefundableCreditsCents: result.provincialBasicPersonalCreditCents + result.provincialOtherCreditsCents,
      provincialRefundableCreditsCents: 0,
      provincialTaxPayableCents: result.provincialTaxPayableCents,
      provincialTaxWithheldCents: result.provincialTaxWithheldCents,
      provincialBalanceCents: result.provincialBalanceCents,
      totalBalanceCents: result.totalBalanceCents,
      calculationDetails: JSON.stringify(result.breakdown),
      calculationVersion: "1.0",
      rulesSnapshotVersion: result.rulesVersion,
      isPreliminary: true,
    }).returning();

    return NextResponse.json({
      calculationId: saved.id,
      result,
      warning: "RÉSULTATS PRÉLIMINAIRES — Aucune déclaration transmise.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur de calcul";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
