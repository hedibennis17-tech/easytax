import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles, taxReturns, incomeEntries, deductionEntries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import path from "path";
import fs from "fs";

export async function GET() {
  const diag: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    steps: [] as string[],
    errors: [] as string[],
  };
  const steps = diag.steps as string[];
  const errors = diag.errors as string[];

  // 1. Auth
  try {
    const { userId } = await auth();
    steps.push(`✓ Auth: ${userId ? "connecté" : "non connecté"}`);
    if (!userId) { errors.push("Non authentifié"); return NextResponse.json(diag); }

    // 2. Profil
    const [profile] = await db.select({ id: taxProfiles.id, province: taxProfiles.province, firstName: taxProfiles.firstName })
      .from(taxProfiles).where(eq(taxProfiles.userId, userId)).limit(1);
    steps.push(`✓ Profil: ${profile ? `${profile.firstName} (${profile.province})` : "ABSENT"}`);

    // 3. TaxReturn
    if (profile) {
      const [tr] = await db.select({ id: taxReturns.id })
        .from(taxReturns).where(eq(taxReturns.profileId, profile.id))
        .orderBy(desc(taxReturns.updatedAt)).limit(1);
      steps.push(`✓ TaxReturn: ${tr ? tr.id : "ABSENT"}`);

      if (tr) {
        // 4. Entrées
        const inc = await db.select({ id: incomeEntries.id, category: incomeEntries.category, amountCents: incomeEntries.amountCents })
          .from(incomeEntries).where(eq(incomeEntries.taxReturnId, tr.id));
        steps.push(`✓ IncomeEntries: ${inc.length} entrées`);
        diag.incomes = inc.slice(0, 5);

        const ded = await db.select({ id: deductionEntries.id, category: deductionEntries.category, amountCents: deductionEntries.amountCents })
          .from(deductionEntries).where(eq(deductionEntries.taxReturnId, tr.id));
        steps.push(`✓ DeductionEntries: ${ded.length} entrées`);
      }
    }

    // 5. Dictionnaire JSON
    try {
      const dictPath = path.join(process.cwd(), "src/lib/ocr/dictionnaire-fiscal-complet-2025.json");
      const exists = fs.existsSync(dictPath);
      steps.push(`✓ Dictionnaire JSON: ${exists ? "TROUVÉ" : "ABSENT"} (${dictPath})`);
      if (exists) {
        const d = JSON.parse(fs.readFileSync(dictPath, "utf-8")) as { t1_lines: Record<string, unknown>; tp1_lines: Record<string, unknown> };
        steps.push(`✓ T1 lines: ${Object.keys(d.t1_lines).length}, TP1 lines: ${Object.keys(d.tp1_lines).length}`);
      }
    } catch (e) {
      errors.push(`Dictionnaire: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 6. Page declaration
    const pagePath = path.join(process.cwd(), "src/app/declaration/page.tsx");
    steps.push(`✓ Page /declaration: ${fs.existsSync(pagePath) ? "EXISTE" : "ABSENTE"}`);

    // 7. API declaration route
    const apiPath = path.join(process.cwd(), "src/app/api/declaration/route.ts");
    steps.push(`✓ API /api/declaration: ${fs.existsSync(apiPath) ? "EXISTE" : "ABSENTE"}`);

  } catch (e) {
    errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`);
  }

  diag.ok = errors.length === 0;
  return NextResponse.json(diag, {
    headers: { "Content-Type": "application/json" }
  });
}
