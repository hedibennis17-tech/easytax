import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, taxReturns, incomeEntries, deductionEntries, creditEntries, taxCalculations } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

import path from "path";
import fs from "fs";

type DictT1Line  = { label_fr: string; label_en?: string; section: string };
type DictTP1Line = { label_fr: string; section: string };
type DictType    = { t1_lines: Record<string, DictT1Line>; tp1_lines: Record<string, DictTP1Line> };

function loadDict(): DictType {
  const p = path.join(process.cwd(), "src/lib/ocr/dictionnaire-fiscal-complet-2025.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")) as DictType;
}

function cents(v: number | null | undefined) { return v ?? 0; }

// Mapping catégorie incomeEntries → ligne T1
const CAT_T1: Record<string, string> = {
  employment: "10100", oas: "11300", cpp_benefits: "11400", pension: "11500",
  ei_benefits: "11900", interest: "12100", rental: "12600", capital_gains: "12700",
  rrsp_withdrawal: "12900", scholarships: "13010", self_employment: "13500",
  workers_comp: "14400", other_income: "13000", dividends_eligible: "12000",
  dividends_ineligible: "12000", gis: "14600",
};
const CAT_TP1: Record<string, string> = {
  employment: "101", pension: "122", cpp_benefits: "119", oas: "114",
  ei_benefits: "111", interest: "130", dividends_eligible: "128",
  dividends_ineligible: "128", workers_comp: "148", other_income: "154",
  self_employment: "164", rental: "136", capital_gains: "139",
};
const CAT_DED_T1: Record<string, string> = {
  rrsp: "20800", union_dues: "21200", childcare: "21400",
  moving_expenses: "21900", employment_expenses: "22900", other_deductions: "23200",
};
const CAT_DED_TP1: Record<string, string> = {
  rrsp: "214", union_dues: "210", childcare: "214", other_deductions: "250",
};
const CAT_CREDIT_T1: Record<string, string> = {
  cpp_employee: "30800", ei_employee: "31200", tuition: "32300", donations: "34900",
  disability: "31600", medical: "33099",
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select().from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [taxReturn] = await db.select({ id: taxReturns.id })
    .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
    .orderBy(desc(taxReturns.updatedAt)).limit(1);

  const province = (profile.fiscalResidence ?? profile.province ?? "QC") as string;
  const isQC = province === "QC";

  // Données DB
  const incomes    = taxReturn ? await db.select().from(incomeEntries).where(and(eq(incomeEntries.userId, userId), eq(incomeEntries.taxReturnId, taxReturn.id))) : [];
  const deductions = taxReturn ? await db.select().from(deductionEntries).where(and(eq(deductionEntries.userId, userId), eq(deductionEntries.taxReturnId, taxReturn.id))) : [];
  const creds      = taxReturn ? await db.select().from(creditEntries).where(and(eq(creditEntries.userId, userId), eq(creditEntries.taxReturnId, taxReturn.id))) : [];
  const [calc]     = taxReturn ? await db.select().from(taxCalculations).where(and(eq(taxCalculations.userId, userId), eq(taxCalculations.taxReturnId, taxReturn.id))).orderBy(desc(taxCalculations.calculatedAt)).limit(1) : [undefined];

  // Construire les montants par ligne
  const t1Amounts: Record<string, { cents: number; source: string }> = {};
  const tp1Amounts: Record<string, { cents: number; source: string }> = {};

  const addT1 = (line: string, c: number, src: string) => {
    if (!line || c === 0) return;
    t1Amounts[line] = { cents: (t1Amounts[line]?.cents ?? 0) + c, source: src };
  };
  const addTp1 = (line: string, c: number, src: string) => {
    if (!line || c === 0 || !isQC) return;
    tp1Amounts[line] = { cents: (tp1Amounts[line]?.cents ?? 0) + c, source: src };
  };

  // Revenus
  for (const inc of incomes) {
    const t1l = CAT_T1[inc.category ?? "other_income"];
    const tp1l = CAT_TP1[inc.category ?? "other_income"];
    if (t1l) addT1(t1l, cents(inc.amountCents), "ocr");
    if (tp1l) addTp1(tp1l, cents(inc.amountCents), "ocr");
  }

  // Déductions
  for (const ded of deductions) {
    // Retenues fédérales
    if (ded.description?.includes("Impôt fédéral") || ded.description?.includes("federal tax withheld")) {
      addT1("43700", cents(ded.amountCents), "ocr"); continue;
    }
    if (ded.description?.includes("Impôt du Québec") || ded.description?.includes("provincial tax withheld")) {
      addTp1("451", cents(ded.amountCents), "ocr"); continue;
    }
    const t1l  = CAT_DED_T1[ded.category ?? "other_deductions"];
    const tp1l = CAT_DED_TP1[ded.category ?? "other_deductions"];
    if (t1l) addT1(t1l, cents(ded.amountCents), "ocr");
    if (tp1l) addTp1(tp1l, cents(ded.amountCents), "ocr");
  }

  // Crédits non remboursables
  for (const cr of creds) {
    const t1l = CAT_CREDIT_T1[cr.category ?? "other_credits"];
    if (t1l) addT1(t1l, cents(cr.claimedAmountCents), "ocr");
  }

  // Montant personnel de base (automatique)
  addT1("30000", 1612900, "calculated"); // 16 129 $ × 100
  if (isQC) addTp1("350", 1857100, "calculated"); // 18 571 $ × 100

  // Depuis le moteur fiscal (si disponible)
  if (calc) {
    if (cents(calc.federalTaxPayableCents) > 0)   addT1("40500",  0, "calculated");
    if (cents(calc.provincialTaxPayableCents) > 0 && isQC) addTp1("430", cents(calc.provincialTaxPayableCents), "calculated");
  }

  // Totaux calculés
  const totalRevenu = Object.entries(t1Amounts)
    .filter(([l]) => parseInt(l) >= 10000 && parseInt(l) <= 14999)
    .reduce((s, [, v]) => s + v.cents, 0);
  const totalDed = Object.entries(t1Amounts)
    .filter(([l]) => parseInt(l) >= 20600 && parseInt(l) <= 25999)
    .reduce((s, [, v]) => s + v.cents, 0);
  const revenuNet = Math.max(0, totalRevenu - totalDed);
  const revenuImposable = revenuNet;

  if (totalRevenu > 0)     addT1("15000", totalRevenu, "calculated");
  if (revenuNet > 0)       addT1("23600", revenuNet, "calculated");
  if (revenuImposable > 0) addT1("26000", revenuImposable, "calculated");

  // TP-1 totaux
  if (isQC) {
    const tp1Revenu = Object.entries(tp1Amounts)
      .filter(([l]) => parseInt(l) >= 100 && parseInt(l) <= 199)
      .reduce((s, [, v]) => s + v.cents, 0);
    if (tp1Revenu > 0) addTp1("199", tp1Revenu, "calculated");
    const tp1Ded = Object.entries(tp1Amounts)
      .filter(([l]) => parseInt(l) >= 200 && parseInt(l) <= 299 && parseInt(l) !== 275 && parseInt(l) !== 299)
      .reduce((s, [, v]) => s + v.cents, 0);
    const tp1Net = Math.max(0, tp1Revenu - tp1Ded);
    if (tp1Net > 0)        addTp1("275", tp1Net, "calculated");
    if (tp1Net > 0)        addTp1("299", tp1Net, "calculated");
  }

  // Solde fédéral
  const fedWithheld = t1Amounts["43700"]?.cents ?? 0;
  const fedTax = cents(calc?.federalTaxPayableCents);
  const fedBalance = fedTax - fedWithheld;

  // Solde QC
  const provWithheld = tp1Amounts["451"]?.cents ?? 0;
  const provTax = cents(calc?.provincialTaxPayableCents);
  const provBalance = provTax - provWithheld;

  // Construire les tableaux de lignes complets (toutes les lignes du dictionnaire)
  const buildLines = (
    dict: Record<string, { label_fr: string; label_en?: string; section: string }>,
    amounts: Record<string, { cents: number; source: string }>,
    form: "t1" | "tp1"
  ) => Object.entries(dict).map(([line, info]) => {
    const a = amounts[line];
    const isTotal = ["15000","23600","26000","199","275","299"].includes(line);
    const isSolde = ["48400","48500","474","475"].includes(line);
    return {
      line,
      label_fr: info.label_fr,
      label_en: (info as { label_fr: string; label_en?: string; section: string }).label_en ?? info.label_fr,
      section: info.section,
      amountCents: a?.cents ?? 0,
      isEditable: !isTotal,
      source: (a?.source ?? "empty") as "ocr" | "manual" | "calculated" | "empty",
      bold: isTotal || isSolde,
      isTotal,
    };
  }).sort((a, b) => parseInt(a.line) - parseInt(b.line));

  const _dict = loadDict();
  const t1Lines  = buildLines(_dict.t1_lines, t1Amounts, "t1");
  const tp1Lines = isQC ? buildLines(
    _dict.tp1_lines as Record<string, DictT1Line>,
    tp1Amounts,
    "tp1"
  ) : [];

  // Provinces
  const PROV_NAMES: Record<string, string> = {
    QC:"Québec",ON:"Ontario",AB:"Alberta",BC:"Colombie-Britannique",SK:"Saskatchewan",
    MB:"Manitoba",NB:"Nouveau-Brunswick",NS:"Nouvelle-Écosse",PE:"Île-du-Prince-Édouard",
    NL:"Terre-Neuve-et-Labrador",NT:"Territoires du Nord-Ouest",NU:"Nunavut",YT:"Yukon",
  };

  return NextResponse.json({
    meta: {
      taxYear: 2025,
      province,
      provinceName: PROV_NAMES[province] ?? province,
      form: isQC ? "T1 + TP-1" : `T1 + ${province}428`,
      isQC,
      profileName: `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() || "—",
      sinLastFour: profile.sinLastFour,
      address: [profile.address, profile.city, province, profile.postalCode].filter(Boolean).join(", "),
      isPreliminary: true,
    },
    t1: t1Lines,
    tp1: tp1Lines,
    summary: {
      totalRevenuCents: totalRevenu,
      revenuNetCents: revenuNet,
      revenuImposableCents: revenuImposable,
      federal:   { taxPayable: fedTax,  withheld: fedWithheld,  balance: fedBalance,  isRefund: fedBalance < 0  },
      provincial:{ taxPayable: provTax, withheld: provWithheld, balance: provBalance, isRefund: provBalance < 0 },
      totalBalance: fedBalance + provBalance,
      isRefund: (fedBalance + provBalance) < 0,
    },
  });
}
