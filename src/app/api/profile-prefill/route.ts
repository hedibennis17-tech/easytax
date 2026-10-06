/**
 * GET /api/profile-prefill
 * Retourne toutes les données du taxProfile formatées en réponses questionnaire.
 * TOUTES les données entrées à la création de compte sont retournées ici.
 * L'user les voit pré-remplies dans la section Profil et n'a qu'à confirmer.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { taxProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [profile] = await db.select().from(taxProfiles)
    .where(eq(taxProfiles.userId, clerkUserId)).limit(1);

  if (!profile) return NextResponse.json({ answers: {}, profile: null });

  // ── Mapper les colonnes DB → réponses questionnaire ──────────────────────
  const answers: Record<string, unknown> = {};

  // Province → t0 (question 0 du triage — la plus importante)
  const province = profile.fiscalResidence ?? profile.province;
  if (province) {
    answers["t0"]              = province;
    answers["province"]        = province;
    answers["p14"]             = province;  // question province dans profil
    answers["p5_province"]     = province;
  }

  // Identité
  if (profile.lastName)    answers["p1"]  = profile.lastName;
  if (profile.firstName)   answers["p2"]  = profile.firstName;
  if (profile.dateOfBirth) answers["p4"]  = profile.dateOfBirth;
  if (profile.sinLastFour) answers["p3_hint"] = `NAS ···· ${profile.sinLastFour}`;

  // Contact
  if (profile.phone) answers["p7"] = profile.phone;
  if (profile.email) answers["p8"] = profile.email;

  // Adresse complète
  if (profile.address)    answers["p5_address"] = profile.address;
  if (profile.city)       answers["p5_city"]    = profile.city;
  if (profile.postalCode) answers["p5_postal"]  = profile.postalCode;

  // Adresse combinée pour affichage
  if (profile.address && profile.city) {
    answers["adresse_complete"] = [profile.address, profile.city, province, profile.postalCode]
      .filter(Boolean).join(", ");
  }

  // Statut canadien
  if (profile.isCanadianCitizen !== null) {
    answers["p11"] = profile.isCanadianCitizen ? "Citoyen" : "Résident permanent";
  }

  // Langue (QC → Français par défaut)
  answers["p9"]  = province === "QC" ? "Français" : "Anglais";
  if (province === "QC") answers["p10"] = "Français";

  // ── État civil → section famille dans le profil ─────────────────────────
  const MARITAL_MAP: Record<string, string> = {
    single:      "Célibataire",
    married:     "Marié(e)",
    common_law:  "Conjoint(e) de fait",
    separated:   "Séparé(e)",
    divorced:    "Divorcé(e)",
    widowed:     "Veuf/Veuve",
  };
  if (profile.maritalStatus) {
    answers["f1"] = MARITAL_MAP[profile.maritalStatus] ?? profile.maritalStatus;
    // Si marié ou conjoint → activer la section famille
    if (["married","common_law"].includes(profile.maritalStatus)) {
      answers["t6"] = true;
    }
  }

  // ── Données complètes du wizard pancanadien ──────────────────────────────
  interface PancanadianData {
    marital?: string;
    maritalDate?: string;
    members?: Array<{
      relation?: string;
      firstName?: string;
      lastName?: string;
      birthDate?: string;
      income?: string;
    }>;
    language?: string;
    canStatus?: string;
    nordZone?: string;
    taxProvince?: string;
    taxYear?: string | number;
    situations?: string[];
    gender?: string;
    usageName?: string;
    otherNames?: string;
    arrivalDate?: string;
    departDate?: string;
    prevProvince?: string;
    preparer?: string;
  }

  let panData: PancanadianData = {};
  if (profile.pancanadianData) {
    try {
      panData = JSON.parse(profile.pancanadianData) as PancanadianData;
    } catch { /* JSON invalide */ }
  }

  // Langue depuis panData
  if (panData.language) {
    answers["p9"]  = panData.language === "fr" ? "Français" : "Anglais";
  }

  // Statut canadien depuis panData
  if (panData.canStatus) {
    const s = panData.canStatus.toLowerCase();
    if (s.includes("citoyen") || s.includes("citizen"))         answers["p11"] = "Citoyen";
    else if (s.includes("permanent"))                            answers["p11"] = "Résident permanent";
    else if (s.includes("visiteur") || s.includes("visitor"))   answers["p11"] = "Visiteur";
    else if (s.includes("étudiant") || s.includes("student"))   answers["p11"] = "Étudiant étranger";
    else if (s.includes("travailleur") || s.includes("worker")) answers["p11"] = "Travailleur étranger";
  }

  // Zone nordique
  if (panData.nordZone && panData.nordZone !== "non") {
    answers["nord_zone"] = panData.nordZone;
  }

  // Province fiscale de résidence
  if (panData.taxProvince) {
    answers["t0"]    = panData.taxProvince;
    answers["province"] = panData.taxProvince;
  }

  // Situations particulières
  if (Array.isArray(panData.situations) && panData.situations.length > 0) {
    answers["t7"] = true; // situation particulière
    answers["situations"] = panData.situations;
    if (panData.situations.some(s => s.includes("immigr"))) answers["p17"] = true;
    if (panData.situations.some(s => s.includes("émigr"))) answers["p18"] = true;
    if (panData.situations.some(s => s.includes("déménag"))) answers["p16"] = true;
    if (panData.situations.some(s => s.includes("faillite"))) answers["p20"] = true;
    if (panData.situations.some(s => s.includes("décès"))) answers["p21"] = true;
  }

  // ── Membres de famille ─────────────────────────────────────────────────
  const members = panData.members ?? [];
  const children = members.filter(m =>
    ["enfant","child","fils","fille","son","daughter"].some(k =>
      (m.relation ?? "").toLowerCase().includes(k)
    )
  );
  const spouse = members.find(m =>
    ["conjoint","spouse","époux","épouse","partner"].some(k =>
      (m.relation ?? "").toLowerCase().includes(k)
    )
  );

  if (members.length > 0) {
    answers["f4"] = true; // a des personnes à charge
    answers["f5"] = members.length;
    answers["t6"] = true;
  }

  // Conjoint
  if (spouse) {
    answers["f3_nom"]       = `${spouse.firstName ?? ""} ${spouse.lastName ?? ""}`.trim();
    answers["f3_revenus"]   = spouse.income ?? "";
    answers["f3_naissance"] = spouse.birthDate ?? "";
  }

  // Enfants (2 premiers)
  if (children[0]) {
    answers["f6_1"]  = `${children[0].firstName ?? ""} ${children[0].lastName ?? ""}`.trim();
    answers["f6_1b"] = children[0].birthDate ?? "";
  }
  if (children[1]) {
    answers["f6_2"]  = `${children[1].firstName ?? ""} ${children[1].lastName ?? ""}`.trim();
    answers["f6_2b"] = children[1].birthDate ?? "";
  }
  if (children.length > 2) {
    answers["f6_3"] = children.slice(2)
      .map(c => `${c.firstName ?? ""} ${c.lastName ?? ""} (${c.birthDate ?? ""})`.trim())
      .join(", ");
  }

  return NextResponse.json({
    answers,
    profile: {
      id:             profile.id,
      firstName:      profile.firstName,
      lastName:       profile.lastName,
      dateOfBirth:    profile.dateOfBirth,
      sinLastFour:    profile.sinLastFour,
      phone:          profile.phone,
      email:          profile.email,
      address:        profile.address,
      city:           profile.city,
      province,
      postalCode:     profile.postalCode,
      maritalStatus:  profile.maritalStatus,
      isCanadianCitizen: profile.isCanadianCitizen,
      fiscalResidence:   profile.fiscalResidence,
    },
    familyMembers: members,
  });
}
