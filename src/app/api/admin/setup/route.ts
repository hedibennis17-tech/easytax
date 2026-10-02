import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { taxYears, taxProfiles, users, documentTypes, jurisdictions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (token !== process.env.MIGRATE_SECRET) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const results: string[] = [];

  // Années fiscales
  for (const year of [2023, 2024, 2025, 2026]) {
    const ex = await db.select({ id: taxYears.id }).from(taxYears).where(eq(taxYears.year, year)).limit(1);
    if (!ex[0]) { await db.insert(taxYears).values({ year, status: "open" }); results.push(`✅ Année ${year}`); }
    else results.push(`⏭️ Année ${year} existe`);
  }

  // Types de documents
  const docTypes = [
    { code: "T4", labelFr: "T4 — Rémunération payée", labelEn: "T4 — Remuneration Paid", category: "employment", isFederal: true, isQuebec: false, sortOrder: 10 },
    { code: "RL-1", labelFr: "RL-1 — Revenus d'emploi", labelEn: "RL-1 — Employment Income", category: "employment", isFederal: false, isQuebec: true, sortOrder: 11 },
    { code: "T4A", labelFr: "T4A — Pension et retraite", labelEn: "T4A — Pension", category: "employment", isFederal: true, isQuebec: false, sortOrder: 12 },
    { code: "T5", labelFr: "T5 — Revenus de placements", labelEn: "T5 — Investment Income", category: "investment", isFederal: true, isQuebec: false, sortOrder: 20 },
    { code: "RL-2", labelFr: "RL-2 — Revenus de retraite", labelEn: "RL-2 — Retirement", category: "investment", isFederal: false, isQuebec: true, sortOrder: 21 },
    { code: "MEDICAL", labelFr: "Reçus médicaux", labelEn: "Medical Receipts", category: "medical", isFederal: true, isQuebec: true, sortOrder: 40 },
    { code: "DONATION", labelFr: "Dons de bienfaisance", labelEn: "Charitable Donations", category: "donations", isFederal: true, isQuebec: true, sortOrder: 41 },
    { code: "OTHER", labelFr: "Autre document", labelEn: "Other Document", category: "other", isFederal: true, isQuebec: true, sortOrder: 99 },
  ];
  for (const dt of docTypes) {
    const ex = await db.select({ id: documentTypes.id }).from(documentTypes).where(eq(documentTypes.code, dt.code)).limit(1);
    if (!ex[0]) { await db.insert(documentTypes).values({ ...dt, isActive: true }); results.push(`✅ Type ${dt.code}`); }
    else results.push(`⏭️ Type ${dt.code} existe`);
  }

  // Juridictions
  const juris = [
    { code: "CA", nameFr: "Canada (fédéral)", nameEn: "Canada (Federal)", jurisdictionLevel: "federal" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "QC", nameFr: "Québec", nameEn: "Quebec", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA_AND_REVENU_QUEBEC" as const, hasProvincialReturn: true },
    { code: "ON", nameFr: "Ontario", nameEn: "Ontario", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "BC", nameFr: "Colombie-Britannique", nameEn: "British Columbia", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "AB", nameFr: "Alberta", nameEn: "Alberta", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "MB", nameFr: "Manitoba", nameEn: "Manitoba", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "SK", nameFr: "Saskatchewan", nameEn: "Saskatchewan", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "NB", nameFr: "Nouveau-Brunswick", nameEn: "New Brunswick", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "NS", nameFr: "Nouvelle-Écosse", nameEn: "Nova Scotia", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "NL", nameFr: "Terre-Neuve", nameEn: "Newfoundland", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "PE", nameFr: "Île-du-Prince-Édouard", nameEn: "PEI", jurisdictionLevel: "provincial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "YT", nameFr: "Yukon", nameEn: "Yukon", jurisdictionLevel: "territorial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "NT", nameFr: "Territoires du Nord-Ouest", nameEn: "Northwest Territories", jurisdictionLevel: "territorial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
    { code: "NU", nameFr: "Nunavut", nameEn: "Nunavut", jurisdictionLevel: "territorial" as const, taxAdministration: "CRA" as const, hasProvincialReturn: false },
  ];
  for (const j of juris) {
    const ex = await db.select({ id: jurisdictions.id }).from(jurisdictions).where(eq(jurisdictions.code, j.code)).limit(1);
    if (!ex[0]) { await db.insert(jurisdictions).values({ ...j, countryCode: "CA", isActive: true }); results.push(`✅ Juridiction ${j.code}`); }
    else results.push(`⏭️ Juridiction ${j.code} existe`);
  }

  // Profil fiscal
  const clerkId = req.nextUrl.searchParams.get("clerkId");
  if (clerkId) {
    const profileEx = await db.select({ id: taxProfiles.id }).from(taxProfiles).where(eq(taxProfiles.userId, clerkId)).limit(1);
    if (!profileEx[0]) {
      const userRows = await db.select().from(users).where(eq(users.clerkUserId, clerkId)).limit(1);
      const u = userRows[0];
      if (u) {
        await db.insert(taxProfiles).values({
          userId: clerkId, firstName: u.firstName ?? "Hedi", lastName: u.lastName ?? "Bennis",
          email: u.email, isQuebecResident: true, fiscalResidence: "QC", province: "QC",
        });
        results.push(`✅ Profil fiscal créé`);
      }
    } else results.push(`⏭️ Profil fiscal existe`);
  }

  return NextResponse.json({ success: true, results });
}
