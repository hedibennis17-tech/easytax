/**
 * GET /api/declaration
 * Agrège TOUTES les données pour pré-remplir la déclaration T1 + TP-1
 * Sources: taxProfile + incomeEntries + deductionEntries + creditEntries + taxCalculations
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import {
  taxProfiles, taxReturns, taxYears,
  incomeEntries, deductionEntries, creditEntries, taxCalculations,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getLineMapping, T1_LINES, TP1_LINES, SLIP_LINE_MAPS } from "@/lib/slip-line-map";

function cents(v: number | null | undefined) { return v ?? 0; }
function fmt(c: number) {
  return (c / 100).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " $";
}

export async function GET() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select().from(taxProfiles)
    .where(eq(taxProfiles.userId, clerkUserId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [taxReturn] = await db.select({ id: taxReturns.id, taxYearId: taxReturns.taxYearId })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);

  const province = (profile.fiscalResidence ?? profile.province ?? "QC") as string;
  const isQC = province === "QC";

  // Revenus, déductions, crédits
  const incomes    = taxReturn ? await db.select().from(incomeEntries)   .where(and(eq(incomeEntries.userId,    clerkUserId), eq(incomeEntries.taxReturnId,    taxReturn.id))) : [];
  const deductions = taxReturn ? await db.select().from(deductionEntries).where(and(eq(deductionEntries.userId, clerkUserId), eq(deductionEntries.taxReturnId, taxReturn.id))) : [];
  const credits    = taxReturn ? await db.select().from(creditEntries)   .where(and(eq(creditEntries.userId,    clerkUserId), eq(creditEntries.taxReturnId,    taxReturn.id))) : [];
  const [calc]     = taxReturn ? await db.select().from(taxCalculations) .where(and(eq(taxCalculations.userId,  clerkUserId), eq(taxCalculations.taxReturnId,  taxReturn.id))).orderBy(desc(taxCalculations.calculatedAt)).limit(1) : [undefined];

  // ── Construire les lignes T1 ────────────────────────────────────────────
  const t1: Record<string, number> = {};   // ligne → cents
  const tp1: Record<string, number> = {};  // ligne → cents

  // Depuis incomeEntries (chaque entry a une catégorie)
  for (const inc of incomes) {
    // Mapper catégorie → ligne T1
    type LineRef = { t1: string; tp1?: string };
  const catLineMap: Record<string, LineRef> = {
      employment:          { t1: "10100", tp1: "101" },
      self_employment:     { t1: "13500", tp1: "164" },
      rental:              { t1: "12600" },
      interest:            { t1: "12100", tp1: "130" },
      dividends_eligible:  { t1: "12000", tp1: "128" },
      dividends_ineligible:{ t1: "12000", tp1: "128" },
      capital_gains:       { t1: "12700", tp1: "139" },
      pension:             { t1: "11500", tp1: "111" },
      cpp_benefits:        { t1: "11400", tp1: "114" },
      oas:                 { t1: "11300", tp1: "114" },
      ei_benefits:         { t1: "11900", tp1: "154" },
      rrsp_withdrawal:     { t1: "12900", tp1: "122" },
      workers_comp:        { t1: "14400", tp1: "148" },
      scholarships:        { t1: "13010", tp1: "154" },
      other_income:        { t1: "13000", tp1: "154" },
    };
    const mapping = catLineMap[inc.category ?? "other_income"];
    if (mapping) {
      t1[mapping.t1] = (t1[mapping.t1] ?? 0) + cents(inc.amountCents);
      if (mapping.tp1 && isQC) tp1[mapping.tp1] = (tp1[mapping.tp1] ?? 0) + cents(inc.amountCents);
    }
  }

  // Déductions
  const dedLineMap: Record<string, { t1: string; tp1?: string }> = {
    rrsp:           { t1: "20800", tp1: "208" },
    union_dues:     { t1: "21200", tp1: "210" },
    childcare:      { t1: "21400", tp1: "214" },
    moving_expenses:{ t1: "21900" },
    employment_expenses: { t1: "22900" },
    other_deductions: { t1: "23200", tp1: "207" },
  };
  for (const ded of deductions) {
    const mapping = dedLineMap[ded.category ?? "other_deductions"];
    if (mapping) {
      t1[mapping.t1] = (t1[mapping.t1] ?? 0) + cents(ded.amountCents);
      if (mapping.tp1 && isQC) tp1[mapping.tp1] = (tp1[mapping.tp1] ?? 0) + cents(ded.amountCents);
    }
  }

  // Retenues (withheld)
  for (const ded of deductions) {
    if (ded.description?.includes("Impôt fédéral") || ded.description?.includes("federal tax withheld")) {
      t1["43700"] = (t1["43700"] ?? 0) + cents(ded.amountCents);
    }
    if (isQC && (ded.description?.includes("Impôt du Québec") || ded.description?.includes("provincial tax withheld"))) {
      tp1["451"] = (tp1["451"] ?? 0) + cents(ded.amountCents);
    }
  }

  // ── Totaux calculés ─────────────────────────────────────────────────────
  const totalRevenu = Object.entries(t1)
    .filter(([k]) => parseInt(k) >= 10000 && parseInt(k) <= 14999)
    .reduce((s, [, v]) => s + v, 0);

  const totalDeductions = Object.entries(t1)
    .filter(([k]) => parseInt(k) >= 20000 && parseInt(k) <= 25999)
    .reduce((s, [, v]) => s + v, 0);

  const revenuNet = Math.max(0, totalRevenu - totalDeductions);
  const revenuImposable = revenuNet; // simplifié

  // Impôt fédéral estimé depuis le moteur fiscal
  const fedTax       = cents(calc?.federalTaxPayableCents);
  const fedWithheld  = t1["43700"] ?? 0;
  const fedBalance   = fedTax - fedWithheld;
  const provTax      = cents(calc?.provincialTaxPayableCents);
  const provWithheld = tp1["451"] ?? 0;
  const provBalance  = provTax - provWithheld;

  // ── Profil ──────────────────────────────────────────────────────────────
  const PROVINCE_NAMES: Record<string, { fr: string; form: string; agency: string }> = {
    QC: { fr: "Québec",                   form: "T1 + TP-1", agency: "Revenu Québec" },
    ON: { fr: "Ontario",                  form: "T1 + ON428", agency: "ARC" },
    AB: { fr: "Alberta",                  form: "T1 + AT1",   agency: "ARC" },
    BC: { fr: "Colombie-Britannique",     form: "T1 + BC428", agency: "ARC" },
    SK: { fr: "Saskatchewan",             form: "T1 + SK428", agency: "ARC" },
    MB: { fr: "Manitoba",                 form: "T1 + MB428", agency: "ARC" },
    NB: { fr: "Nouveau-Brunswick",        form: "T1 + NB428", agency: "ARC" },
    NS: { fr: "Nouvelle-Écosse",          form: "T1 + NS428", agency: "ARC" },
    PE: { fr: "Île-du-Prince-Édouard",    form: "T1 + PE428", agency: "ARC" },
    NL: { fr: "Terre-Neuve-et-Labrador",  form: "T1 + NL428", agency: "ARC" },
    NT: { fr: "Territoires du Nord-Ouest",form: "T1 + NT428", agency: "ARC" },
    NU: { fr: "Nunavut",                  form: "T1 + NU428", agency: "ARC" },
    YT: { fr: "Yukon",                    form: "T1 + YT428", agency: "ARC" },
  };

  return NextResponse.json({
    meta: {
      taxYear: 2025,
      province,
      provinceName: PROVINCE_NAMES[province]?.fr ?? province,
      form: PROVINCE_NAMES[province]?.form ?? "T1",
      agency: PROVINCE_NAMES[province]?.agency ?? "ARC",
      isQC,
      profileName: `${profile.firstName} ${profile.lastName}`,
      sinLastFour: profile.sinLastFour,
      maritalStatus: profile.maritalStatus,
      address: [profile.address, profile.city, province, profile.postalCode].filter(Boolean).join(", "),
      isPreliminary: true,
      hasCalculation: !!calc,
    },
    // Lignes T1 pré-remplies
    t1Lines: Object.entries(T1_LINES).map(([line, info]) => ({
      line,
      ...info,
      amountCents: t1[line] ?? 0,
      amount: fmt(t1[line] ?? 0),
      hasValue: (t1[line] ?? 0) > 0,
      source: "ocr" as const,
    })),
    // Lignes TP-1 (QC seulement)
    tp1Lines: isQC ? Object.entries(TP1_LINES).map(([line, info]) => ({
      line,
      ...info,
      amountCents: tp1[line] ?? 0,
      amount: fmt(tp1[line] ?? 0),
      hasValue: (tp1[line] ?? 0) > 0,
    })) : [],
    // Résumé
    summary: {
      totalRevenu: fmt(totalRevenu),
      totalRevenuCents: totalRevenu,
      totalDeductions: fmt(totalDeductions),
      revenuNet: fmt(revenuNet),
      revenuNetCents: revenuNet,
      revenuImposable: fmt(revenuImposable),
      federal: { taxPayable: fmt(fedTax), withheld: fmt(fedWithheld), balance: fmt(fedBalance), balanceCents: fedBalance, isRefund: fedBalance < 0 },
      provincial: { taxPayable: fmt(provTax), withheld: fmt(provWithheld), balance: fmt(provBalance), balanceCents: provBalance, isRefund: provBalance < 0 },
      totalBalance: fmt(fedBalance + provBalance),
      totalBalanceCents: fedBalance + provBalance,
      isRefund: (fedBalance + provBalance) < 0,
    },
  });
}
