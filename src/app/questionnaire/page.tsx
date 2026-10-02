"use client";
import { NavClient } from "@/components/NavClient";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── QUESTIONS ────────────────────────────────────────────────────────────────

const QUESTIONS = [
  // EMPLOI
  {
    code: "has_employment_income",
    section: "employment",
    textFr: "Avez-vous eu un revenu d'emploi en 2025 ?",
    hintFr: "Salaires, traitements, pourboires, commissions",
    type: "BOOLEAN",
    required: true,
  },
  {
    code: "has_additional_employers",
    section: "employment",
    textFr: "Avez-vous eu plus d'un employeur en 2025 ?",
    hintFr: "Incluez les emplois à temps partiel ou saisonniers",
    type: "BOOLEAN",
    required: false,
    showIf: "has_employment_income",
  },
  {
    code: "worked_from_home",
    section: "employment",
    textFr: "Avez-vous travaillé de la maison en 2025 ?",
    hintFr: "Vous pourriez avoir droit à des déductions pour bureau à domicile",
    type: "BOOLEAN",
    required: false,
    showIf: "has_employment_income",
  },

  // TRAVAIL AUTONOME
  {
    code: "has_self_employment",
    section: "self_employment",
    textFr: "Avez-vous eu des revenus de travail autonome ou d'entreprise en 2025 ?",
    hintFr: "Freelance, contrats, vente de biens ou services",
    type: "BOOLEAN",
    required: true,
  },
  {
    code: "self_employment_vehicle",
    section: "self_employment",
    textFr: "Avez-vous utilisé un véhicule pour votre travail autonome ?",
    hintFr: "Les frais d'automobile peuvent être déductibles au prorata",
    type: "BOOLEAN",
    required: false,
    showIf: "has_self_employment",
  },
  {
    code: "self_employment_home_office",
    section: "self_employment",
    textFr: "Avez-vous un bureau à domicile pour votre entreprise ?",
    hintFr: "Une partie de vos frais de logement peut être déductible",
    type: "BOOLEAN",
    required: false,
    showIf: "has_self_employment",
  },

  // INVESTISSEMENTS
  {
    code: "has_investment_income",
    section: "investment",
    textFr: "Avez-vous eu des revenus de placement en 2025 ?",
    hintFr: "Intérêts, dividendes, gains en capital",
    type: "BOOLEAN",
    required: true,
  },

  // LOCATION
  {
    code: "has_rental_income",
    section: "investment",
    textFr: "Avez-vous eu des revenus de location en 2025 ?",
    hintFr: "Location d'un appartement, d'une chambre ou d'un local",
    type: "BOOLEAN",
    required: true,
  },

  // REER
  {
    code: "has_rrsp_contribution",
    section: "deductions",
    textFr: "Avez-vous cotisé à un REER en 2025 ou avant le 3 mars 2026 ?",
    hintFr: "Les cotisations REER réduisent votre revenu imposable",
    type: "BOOLEAN",
    required: true,
  },

  // FAMILLE
  {
    code: "has_dependents",
    section: "family",
    textFr: "Avez-vous des personnes à charge (enfants, parents, etc.) ?",
    hintFr: "Cela peut ouvrir droit à plusieurs crédits",
    type: "BOOLEAN",
    required: true,
  },
  {
    code: "childcare_expenses",
    section: "family",
    textFr: "Avez-vous payé des frais de garde d'enfants en 2025 ?",
    hintFr: "Garderie, camp de jour, garde à domicile",
    type: "BOOLEAN",
    required: false,
    showIf: "has_dependents",
  },

  // DÉMÉNAGEMENT
  {
    code: "changed_province",
    section: "other",
    textFr: "Avez-vous changé de province de résidence en 2025 ?",
    type: "BOOLEAN",
    required: false,
  },

  // REVENU ÉTRANGER
  {
    code: "has_foreign_income",
    section: "other",
    textFr: "Avez-vous eu des revenus provenant de l'extérieur du Canada en 2025 ?",
    type: "BOOLEAN",
    required: false,
  },
] as const;

type QuestionCode = typeof QUESTIONS[number]["code"];

// ─── COMPOSANT ────────────────────────────────────────────────────────────────

export default function QuestionnairePage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Filtrer les questions visibles selon les réponses actuelles
  const visibleQuestions = QUESTIONS.filter((q) => {
    if ("showIf" in q && q.showIf) {
      return answers[q.showIf] === true;
    }
    return true;
  });

  const current = visibleQuestions[currentIdx];
  const progress = Math.round(((currentIdx) / visibleQuestions.length) * 100);
  const isLast = currentIdx === visibleQuestions.length - 1;

  const handleAnswer = useCallback(async (value: boolean) => {
    if (!current) return;
    const newAnswers = { ...answers, [current.code]: value };
    setAnswers(newAnswers);
    setSaving(true);

    // Sauvegarde progressive — l'utilisateur peut quitter et revenir
    try {
      await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionCode: current.code,
          answerValue: value,
          taxReturnId: "demo-return-id", // TODO: récupérer depuis la session
          taxYearId: "demo-year-id",
        }),
      });
    } catch {
      // Silencieux — on continue même si la sauvegarde échoue
    }

    setSaving(false);

    if (isLast) {
      setDone(true);
    } else {
      // Trouver le prochain index visible
      const updatedVisible = QUESTIONS.filter((q) => {
        if ("showIf" in q && q.showIf) return newAnswers[q.showIf] === true;
        return true;
      });
      const nextIdx = currentIdx + 1;
      if (nextIdx < updatedVisible.length) {
        setCurrentIdx(nextIdx);
      } else {
        setDone(true);
      }
    }
  }, [current, answers, currentIdx, isLast]);

  const handleBack = () => {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  const getSectionLabel = (section: string) => {
    const labels: Record<string, string> = {
      employment: "💼 Emploi",
      self_employment: "🧑‍💼 Travail autonome",
      investment: "📈 Placements & Location",
      deductions: "📉 Déductions",
      family: "🏠 Famille",
      other: "🌍 Autre",
    };
    return labels[section] ?? section;
  };

  // Résumé des réponses
  const getSummary = () => {
    const yesAnswers = Object.entries(answers).filter(([, v]) => v === true);
    const q = QUESTIONS as readonly typeof QUESTIONS[number][];
    return yesAnswers.map(([code]) => {
      const question = q.find((q) => q.code === code);
      return question?.textFr ?? code;
    });
  };

  if (done) {
    return (
      <main style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
        <NavClient />

        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Questionnaire terminé</h1>
            <p className="text-gray-500 mb-6">
              Vos réponses ont été sauvegardées. Votre dossier fiscal sera mis à jour.
            </p>

            {/* Résumé */}
            {getSummary().length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Éléments déclarés
                </h2>
                <ul className="space-y-2">
                  {getSummary().map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left mb-6">
              <p className="text-xs text-amber-700">
                ⚠️ <strong>Ces informations sont préliminaires.</strong> Aucune déclaration n&apos;a encore été transmise à l&apos;ARC ou à Revenu Québec. Votre dossier sera calculé dans l&apos;étape suivante.
              </p>
            </div>

            <div className="flex gap-3">
              <Link
                href="/dossier"
                className="flex-1 bg-red-600 text-white rounded-xl py-3 font-semibold hover:bg-red-700 transition-colors text-sm text-center"
              >
                Voir mon dossier →
              </Link>
              <button
                onClick={() => { setCurrentIdx(0); setDone(false); }}
                className="px-4 py-3 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-xl"
              >
                Réviser
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!current) return null;

  return (
    <main style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavClient />

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Barre de progression */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>{getSectionLabel(current.section)}</span>
            <span>{currentIdx + 1} / {visibleQuestions.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Carte question */}
        <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-2 leading-snug">
            {current.textFr}
          </h2>
          {"hintFr" in current && current.hintFr && (
            <p className="text-sm text-gray-400 mb-8">{current.hintFr}</p>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => handleAnswer(true)}
              disabled={saving}
              className="flex-1 bg-red-600 text-white rounded-xl py-4 font-semibold text-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Oui
            </button>
            <button
              onClick={() => handleAnswer(false)}
              disabled={saving}
              className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-4 font-semibold text-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Non
            </button>
          </div>

          {saving && (
            <p className="text-xs text-gray-400 text-center mt-4">Sauvegarde...</p>
          )}
        </div>

        {/* Retour */}
        {currentIdx > 0 && (
          <button
            onClick={handleBack}
            className="mt-4 text-sm text-gray-400 hover:text-gray-700 flex items-center gap-1"
          >
            ← Question précédente
          </button>
        )}

        {/* Contexte inféré (debug/aide) */}
        {Object.keys(answers).length > 0 && (
          <div className="mt-6 bg-white rounded-xl border border-gray-100 p-4 text-xs text-gray-400">
            <p className="font-semibold mb-1">Déjà connu :</p>
            <ul className="space-y-0.5">
              {Object.entries(answers)
                .filter(([, v]) => v !== null)
                .map(([code, val]) => (
                  <li key={code}>
                    {val ? "✓" : "✗"} {code.replace(/_/g, " ")}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
