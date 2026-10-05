/**
 * GET /api/profile-prefill
 * Retourne les données du taxProfile formatées en réponses de questionnaire.
 * Le questionnaire les injecte directement — l'user ne re-saisit pas ce qu'il a
 * déjà entré lors de la création de compte.
 *
 * Données disponibles dans taxProfile:
 *   firstName, lastName, dateOfBirth, sinLastFour
 *   phone, email, address, city, province, postalCode
 *   maritalStatus, fiscalResidence, isCanadianCitizen
 *   pancanadianData (JSON du wizard complet)
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

const MARITAL_MAP: Record<string, string> = {
  single: "Célibataire", married: "Marié", common_law: "Conjoint de fait",
  separated: "Séparé", divorced: "Divorcé", widowed: "Veuf",
};

export async function GET() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select().from(taxProfiles)
    .where(eq(taxProfiles.userId, clerkUserId)).limit(1);

  if (!profile) return NextResponse.json({ answers: {}, profile: null });

  // Construire les réponses pré-remplies depuis le profil
  const answers: Record<string, unknown> = {};

  // Province → t0 (triage)
  const province = profile.fiscalResidence ?? profile.province;
  if (province) {
    answers["t0"] = province;
    answers["province"] = province;
  }

  // Profil — données personnelles
  if (profile.firstName) answers["p1"] = profile.lastName ?? ""; // p1 = nom de famille
  if (profile.lastName)  answers["p2"] = profile.firstName ?? ""; // p2 = prénom (inversé volontairement)
  // NB: on n'expose PAS le NAS complet, seulement last4 pour affichage
  if (profile.dateOfBirth) answers["p4"] = profile.dateOfBirth;
  if (profile.phone) answers["p7"] = profile.phone;
  if (profile.email) answers["p8"] = profile.email;
  if (profile.address) answers["p5_address"] = profile.address;
  if (profile.city) answers["p5_city"] = profile.city;
  if (province) answers["p5_province"] = province;
  if (profile.postalCode) answers["p5_postal"] = profile.postalCode;
  if (profile.maritalStatus) answers["f1"] = MARITAL_MAP[profile.maritalStatus] ?? profile.maritalStatus;
  if (profile.isCanadianCitizen !== null) answers["p11"] = profile.isCanadianCitizen ? "Citoyen" : "Résident permanent";

  // Pancanadian data (si disponible depuis le wizard)
  let pancanadianAnswers: Record<string, unknown> = {};
  if (profile.pancanadianData) {
    try {
      const pd = JSON.parse(profile.pancanadianData) as Record<string, unknown>;
      // Mapper les champs wizard → IDs questionnaire
      if (pd.marital)      answers["f1"] = pd.marital as string;
      if (pd.nordZone && pd.nordZone !== "non") answers["nord_zone"] = pd.nordZone;
      if (pd.canStatus)    answers["p11"] = pd.canStatus as string;
      if (pd.language)     answers["p9"] = pd.language === "fr" ? "Français" : "Anglais";
      pancanadianAnswers = pd;
    } catch { /* JSON invalide — ignorer */ }
  }

  // Langue ARC
  if (profile.province === "QC" || profile.fiscalResidence === "QC") {
    answers["p10"] = "Français"; // Revenu Québec
  }

  return NextResponse.json({
    answers,
    profile: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      dateOfBirth: profile.dateOfBirth,
      sinLastFour: profile.sinLastFour,
      phone: profile.phone,
      email: profile.email,
      address: profile.address,
      city: profile.city,
      province,
      postalCode: profile.postalCode,
      maritalStatus: profile.maritalStatus,
      isCanadianCitizen: profile.isCanadianCitizen,
    },
    pancanadianData: pancanadianAnswers,
  });
}
