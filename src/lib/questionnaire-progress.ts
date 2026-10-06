import { normalizeProvinceCode, type ProvinceCode } from "@/lib/provinces";
import {
  ALL_INDIVIDUAL_QUESTIONS,
  getAllQuestionsWithProvince,
  INDIVIDUAL_SECTIONS,
  type Question,
} from "@/lib/questionnaire-individual";

export type QuestionnaireProgressSection = {
  code: string;
  fr: string;
  en: string;
  icon: string;
  total: number;
  answered: number;
  percent: number;
  completed: boolean;
};

export type QuestionnaireProgress = {
  version: 1;
  globalPercent: number;
  questionsApplicable: number;
  questionsAnswered: number;
  province: ProvinceCode | null;
  currentSection: string;
  sections: QuestionnaireProgressSection[];
  savedAt: string;
};

function evaluates(condition: string | undefined, answers: Record<string, unknown>): boolean {
  if (!condition) return true;
  const [key, expected] = condition.split("=");
  const actual = String(answers[key] ?? "");
  if (expected === "true") return actual === "true" || actual === "oui";
  if (expected === "false") return actual === "false" || actual === "non";
  return actual === expected;
}

function isApplicable(question: Question, province: ProvinceCode | null): boolean {
  return !question.provinceOnly || (province !== null && question.provinceOnly.includes(province));
}

/**
 * Source unique pour les compteurs affichés dans le questionnaire et le résumé.
 * Une province inconnue ne rend jamais les questions de toutes les provinces visibles.
 */
export function buildIndividualQuestionnaireProgress(
  answers: Record<string, unknown>,
  provinceInput?: unknown,
  currentSectionInput?: string,
): QuestionnaireProgress {
  const province = normalizeProvinceCode(provinceInput)
    ?? normalizeProvinceCode(answers.p14)
    ?? normalizeProvinceCode(answers.q1)
    ?? normalizeProvinceCode(answers.taxProvince)
    ?? normalizeProvinceCode(answers.province)
    ?? normalizeProvinceCode(answers.profil_province);

  const allQuestions = getAllQuestionsWithProvince();
  const triageQuestions = ALL_INDIVIDUAL_QUESTIONS
    .filter(question => question.section === "triage")
    .sort((left, right) => left.order - right.order);

  const visibleSections = INDIVIDUAL_SECTIONS.filter(section =>
    section.code !== "triage" && (
      (section as { alwaysShow?: boolean }).alwaysShow
      || evaluates((section as { showIf?: string }).showIf, answers)
    ),
  );

  const sections: QuestionnaireProgressSection[] = [
    {
      code: "triage",
      fr: "Triage",
      en: "Triage",
      icon: "🧭",
      total: triageQuestions.length,
      answered: triageQuestions.filter(question => answers[question.id] !== undefined).length,
      percent: 0,
      completed: false,
    },
    ...visibleSections.map(section => {
      const questions = allQuestions.filter(question =>
        question.section === section.code
        && evaluates(question.showIf, answers)
        && isApplicable(question, province),
      );
      const answered = questions.filter(question => answers[question.id] !== undefined).length;
      return {
        code: section.code,
        fr: section.fr,
        en: section.en,
        icon: section.icon,
        total: questions.length,
        answered,
        percent: 0,
        completed: false,
      };
    }),
  ].map(section => {
    const percent = section.total > 0 ? Math.round((section.answered / section.total) * 100) : 100;
    return { ...section, percent, completed: section.total > 0 && section.answered >= section.total };
  });

  const questionsApplicable = sections.reduce((total, section) => total + section.total, 0);
  const questionsAnswered = sections.reduce((total, section) => total + section.answered, 0);
  const globalPercent = questionsApplicable > 0
    ? Math.round((questionsAnswered / questionsApplicable) * 100)
    : 0;
  const triageComplete = sections.find(section => section.code === "triage")?.completed ?? false;
  const firstIncomplete = sections.find(section => !section.completed)?.code;

  return {
    version: 1,
    globalPercent,
    questionsApplicable,
    questionsAnswered,
    province,
    currentSection: currentSectionInput ?? firstIncomplete ?? (triageComplete ? "review" : "triage"),
    sections,
    savedAt: new Date().toISOString(),
  };
}
