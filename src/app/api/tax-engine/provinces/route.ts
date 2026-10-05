import { NextResponse } from "next/server";
import { getAuthContext, unauthorized } from "@/lib/auth-helpers";
import { getSupportedProvinces, getProvinceSummary, getRulesForYearAndProvince } from "@/lib/tax-engine/rules/2025";

/**
 * GET /api/tax-engine/provinces?taxYear=2025
 * Sommaire pancanadien pour le volet provincial de la déclaration :
 * nom, formulaire (XX428 / TP-1), montant personnel de base, paliers, surtaxe.
 */
export async function GET(req: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { searchParams } = new URL(req.url);
  const taxYear = Number(searchParams.get("taxYear") ?? 2025);

  const provinces = getSupportedProvinces(taxYear).map((code) => {
    const summary = getProvinceSummary(code);
    const rules = getRulesForYearAndProvince(taxYear, code);
    return {
      code,
      nameFr: summary?.nameFr ?? code,
      nameEn: summary?.nameEn ?? code,
      form: code === "QC" ? "TP-1" : `${code}428`,
      bpaCents: summary?.bpaCents ?? null,
      brackets: rules?.provincialBrackets.map((b) => ({
        minCents: b.minCents,
        maxCents: b.maxCents,
        rateBasisPoints: b.rateBasisPoints,
      })) ?? [],
      hasSurtax: summary?.hasSurtax ?? false,
      creditRateBP: summary?.creditRateBP ?? null,
    };
  });

  return NextResponse.json({ taxYear, provinces });
}
