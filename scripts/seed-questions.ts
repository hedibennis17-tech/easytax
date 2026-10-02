/**
 * Seed — Questions de base du moteur fiscal
 * Lance: npx tsx scripts/seed-questions.ts
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { taxQuestions, taxQuestionOptions, taxQuestionRules } from "../src/db/schema";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// Questions de base — s'appliquent à toutes les juridictions (jurisdictionId null)
const BASE_QUESTIONS = [
  // Section : identité
  { code: "province_of_residence",    section: "identity" as const,    questionType: "SINGLE_CHOICE" as const, textFr: "Dans quelle province ou territoire résidez-vous ?",           textEn: "In which province or territory do you reside?",          required: true,  displayOrder: 10 },
  { code: "is_first_time_filer",      section: "identity" as const,    questionType: "BOOLEAN" as const,       textFr: "Est-ce votre première déclaration de revenus au Canada ?",   textEn: "Is this your first income tax return in Canada?",         required: true,  displayOrder: 20 },
  // Section : famille
  { code: "marital_status",           section: "family" as const,      questionType: "SINGLE_CHOICE" as const, textFr: "Quelle était votre situation matrimoniale au 31 décembre ?", textEn: "What was your marital status on December 31?",            required: true,  displayOrder: 10 },
  { code: "has_dependents",           section: "family" as const,      questionType: "BOOLEAN" as const,       textFr: "Avez-vous des personnes à charge ?",                         textEn: "Do you have any dependants?",                            required: true,  displayOrder: 20 },
  { code: "number_of_dependents",     section: "family" as const,      questionType: "NUMBER" as const,        textFr: "Combien de personnes à charge avez-vous ?",                  textEn: "How many dependants do you have?",                        required: false, displayOrder: 21 },
  // Section : emploi
  { code: "has_employment_income",    section: "employment" as const,  questionType: "BOOLEAN" as const,       textFr: "Avez-vous eu un revenu d'emploi cette année ?",              textEn: "Did you have employment income this year?",               required: true,  displayOrder: 10 },
  { code: "number_of_employers",      section: "employment" as const,  questionType: "NUMBER" as const,        textFr: "Combien d'employeurs avez-vous eus cette année ?",           textEn: "How many employers did you have this year?",              required: false, displayOrder: 11 },
  { code: "has_t4",                   section: "employment" as const,  questionType: "BOOLEAN" as const,       textFr: "Avez-vous reçu un T4 de votre employeur ?",                 textEn: "Did you receive a T4 from your employer?",                required: false, displayOrder: 12 },
  { code: "worked_from_home",         section: "employment" as const,  questionType: "BOOLEAN" as const,       textFr: "Avez-vous travaillé de la maison cette année ?",             textEn: "Did you work from home this year?",                       required: false, displayOrder: 20 },
  // Section : travail autonome
  { code: "has_self_employment",      section: "self_employment" as const, questionType: "BOOLEAN" as const,   textFr: "Avez-vous un revenu de travail autonome ou d'entreprise ?", textEn: "Do you have self-employment or business income?",          required: true,  displayOrder: 10 },
  { code: "has_business_expenses",    section: "self_employment" as const, questionType: "BOOLEAN" as const,   textFr: "Avez-vous des dépenses d'entreprise à déclarer ?",           textEn: "Do you have business expenses to claim?",                 required: false, displayOrder: 20 },
  // Section : placements
  { code: "has_investment_income",    section: "investment" as const,  questionType: "BOOLEAN" as const,       textFr: "Avez-vous un revenu de placement (T5, dividendes, etc.) ?", textEn: "Do you have investment income (T5, dividends, etc.)?",    required: true,  displayOrder: 10 },
  // Section : déductions
  { code: "has_rrsp_contributions",   section: "deductions" as const,  questionType: "BOOLEAN" as const,       textFr: "Avez-vous cotisé à un REER cette année ?",                  textEn: "Did you contribute to an RRSP this year?",               required: true,  displayOrder: 10 },
  { code: "has_medical_expenses",     section: "deductions" as const,  questionType: "BOOLEAN" as const,       textFr: "Avez-vous des frais médicaux à déclarer ?",                 textEn: "Do you have medical expenses to claim?",                  required: true,  displayOrder: 20 },
  { code: "has_charitable_donations", section: "deductions" as const,  questionType: "BOOLEAN" as const,       textFr: "Avez-vous fait des dons de bienfaisance ?",                 textEn: "Did you make any charitable donations?",                  required: true,  displayOrder: 30 },
  { code: "has_tuition",              section: "deductions" as const,  questionType: "BOOLEAN" as const,       textFr: "Avez-vous des frais de scolarité à déclarer ?",              textEn: "Do you have tuition fees to claim?",                      required: true,  displayOrder: 40 },
];

// Règles de visibilité conditionnelle (déclaratives)
const RULES = [
  // Afficher "nombre de personnes à charge" si has_dependents = true
  { questionCode: "number_of_dependents",  conditionCode: "has_dependents",       operator: "eq" as const,  value: "true" },
  // Afficher "nombre d'employeurs" si has_employment_income = true
  { questionCode: "number_of_employers",   conditionCode: "has_employment_income", operator: "eq" as const,  value: "true" },
  // Afficher "avez-vous un T4" si has_employment_income = true
  { questionCode: "has_t4",               conditionCode: "has_employment_income", operator: "eq" as const,  value: "true" },
  // Afficher "travail à domicile" si has_employment_income = true
  { questionCode: "worked_from_home",     conditionCode: "has_employment_income", operator: "eq" as const,  value: "true" },
  // Afficher "dépenses d'entreprise" si has_self_employment = true
  { questionCode: "has_business_expenses",conditionCode: "has_self_employment",   operator: "eq" as const,  value: "true" },
];

async function main() {
  console.log("🌱 Seed — questions du moteur fiscal...");

  const insertedIds: Record<string, string> = {};

  for (const q of BASE_QUESTIONS) {
    try {
      const [inserted] = await db
        .insert(taxQuestions)
        .values({ ...q, version: 1, isActive: true })
        .onConflictDoNothing()
        .returning({ id: taxQuestions.id, code: taxQuestions.code });

      if (inserted) {
        insertedIds[inserted.code] = inserted.id;
        console.log(`✅ Question: ${q.code}`);
      } else {
        console.log(`⏭️  Existe: ${q.code}`);
      }
    } catch (e) {
      console.log(`⚠️  ${q.code}:`, (e as Error).message);
    }
  }

  // Ajouter les options pour province_of_residence
  const provinceQId = insertedIds["province_of_residence"];
  if (provinceQId) {
    const provinces = [
      { value: "AB", labelFr: "Alberta",                   labelEn: "Alberta",                    order: 1 },
      { value: "BC", labelFr: "Colombie-Britannique",       labelEn: "British Columbia",           order: 2 },
      { value: "MB", labelFr: "Manitoba",                   labelEn: "Manitoba",                   order: 3 },
      { value: "NB", labelFr: "Nouveau-Brunswick",          labelEn: "New Brunswick",              order: 4 },
      { value: "NL", labelFr: "Terre-Neuve-et-Labrador",   labelEn: "Newfoundland and Labrador",  order: 5 },
      { value: "NS", labelFr: "Nouvelle-Écosse",            labelEn: "Nova Scotia",                order: 6 },
      { value: "NT", labelFr: "Territoires du Nord-Ouest", labelEn: "Northwest Territories",      order: 7 },
      { value: "NU", labelFr: "Nunavut",                    labelEn: "Nunavut",                    order: 8 },
      { value: "ON", labelFr: "Ontario",                    labelEn: "Ontario",                    order: 9 },
      { value: "PE", labelFr: "Île-du-Prince-Édouard",     labelEn: "Prince Edward Island",       order: 10 },
      { value: "QC", labelFr: "Québec",                     labelEn: "Quebec",                     order: 11 },
      { value: "SK", labelFr: "Saskatchewan",               labelEn: "Saskatchewan",               order: 12 },
      { value: "YT", labelFr: "Yukon",                      labelEn: "Yukon",                      order: 13 },
    ];
    for (const p of provinces) {
      await db.insert(taxQuestionOptions).values({
        questionId: provinceQId,
        value: p.value,
        labelFr: p.labelFr,
        labelEn: p.labelEn,
        displayOrder: p.order,
      }).onConflictDoNothing();
    }
    console.log("✅ Options province ajoutées");
  }

  // Ajouter les règles de visibilité
  for (const rule of RULES) {
    const questionId = insertedIds[rule.questionCode];
    if (!questionId) { console.log(`⏭️  Règle ignorée (question non trouvée): ${rule.questionCode}`); continue; }
    try {
      await db.insert(taxQuestionRules).values({
        questionId,
        conditionQuestionCode: rule.conditionCode,
        operator: rule.operator,
        conditionValue: rule.value,
        action: "show",
        isActive: true,
      }).onConflictDoNothing();
      console.log(`✅ Règle: si ${rule.conditionCode} ${rule.operator} ${rule.value} → afficher ${rule.questionCode}`);
    } catch (e) {
      console.log(`⚠️  Règle ${rule.questionCode}:`, (e as Error).message);
    }
  }

  console.log("✅ Seed questions terminé.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
