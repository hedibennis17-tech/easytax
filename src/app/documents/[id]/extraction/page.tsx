"use client";

import Link from "next/link";
import { useState } from "react";

// Données demo — branchées sur /api/documents/[id]/extraction à l'étape auth
const DEMO_EXTRACTION = {
  status: "needs_review",
  detectedTypeCode: "T4",
  detectedTypeLabelFr: "T4 — État de la rémunération payée",
  classificationConfidence: 95,
  overallConfidence: 88,
  detectedTaxYear: 2025,
  detectedJurisdictionCode: "QC",
  ocrProvider: "mock",
  needsHumanReview: true,
  yearMismatchWarning: false,
};

const DEMO_FIELDS = [
  { id: "1", fieldCode: "box_14",              fieldLabel: "Case 14 — Revenus d'emploi",             rawOcrValue: "52400.00",  validatedValue: null,      ocrConfidence: 96, needsReview: false, isRequired: true,  validationStatus: "unreviewed" },
  { id: "2", fieldCode: "box_16",              fieldLabel: "Case 16 — Cotisations RPC/RRQ",           rawOcrValue: "2860.20",   validatedValue: null,      ocrConfidence: 94, needsReview: false, isRequired: false, validationStatus: "unreviewed" },
  { id: "3", fieldCode: "box_18",              fieldLabel: "Case 18 — Cotisations AE",                rawOcrValue: "780.00",    validatedValue: null,      ocrConfidence: 93, needsReview: false, isRequired: false, validationStatus: "unreviewed" },
  { id: "4", fieldCode: "box_22",              fieldLabel: "Case 22 — Impôt sur le revenu retenu",    rawOcrValue: "9100.00",   validatedValue: null,      ocrConfidence: 91, needsReview: false, isRequired: true,  validationStatus: "unreviewed" },
  { id: "5", fieldCode: "employer_name",       fieldLabel: "Nom de l'employeur",                      rawOcrValue: "ACME CORP", validatedValue: null,      ocrConfidence: 82, needsReview: true,  isRequired: true,  validationStatus: "unreviewed" },
  { id: "6", fieldCode: "province_of_employment", fieldLabel: "Province d'emploi",                   rawOcrValue: "QC",        validatedValue: null,      ocrConfidence: 98, needsReview: false, isRequired: false, validationStatus: "unreviewed" },
];

type FieldState = {
  id: string;
  fieldCode: string;
  fieldLabel: string;
  rawOcrValue: string | null;
  validatedValue: string | null;
  ocrConfidence: number;
  needsReview: boolean;
  isRequired: boolean;
  validationStatus: string;
  editMode?: boolean;
  editValue?: string;
};

function confidenceColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 75) return "text-yellow-600";
  return "text-red-600";
}

function confidenceBadge(score: number): string {
  if (score >= 90) return "bg-green-50 text-green-700 border-green-200";
  if (score >= 75) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export default function ExtractionPage({ params }: { params: { id: string } }) {
  const [fields, setFields] = useState<FieldState[]>(DEMO_FIELDS);
  const [validated, setValidated] = useState(false);

  function startEdit(fieldId: string) {
    setFields((prev) =>
      prev.map((f) =>
        f.id === fieldId
          ? { ...f, editMode: true, editValue: f.validatedValue ?? f.rawOcrValue ?? "" }
          : f
      )
    );
  }

  function saveEdit(fieldId: string) {
    setFields((prev) =>
      prev.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              editMode: false,
              validatedValue: f.editValue ?? f.rawOcrValue,
              validationStatus: f.editValue !== f.rawOcrValue ? "corrected" : "confirmed",
              needsReview: false,
            }
          : f
      )
    );
  }

  function confirmField(fieldId: string) {
    setFields((prev) =>
      prev.map((f) =>
        f.id === fieldId
          ? { ...f, validationStatus: "confirmed", needsReview: false }
          : f
      )
    );
  }

  const allConfirmed = fields.every((f) => f.validationStatus !== "unreviewed");
  const confirmedCount = fields.filter((f) => f.validationStatus !== "unreviewed").length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4">
        <Link href="/documents" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Mes documents
        </Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm font-medium text-gray-900">Vérification OCR</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* En-tête */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                {DEMO_EXTRACTION.detectedTypeLabelFr}
              </h1>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${confidenceBadge(DEMO_EXTRACTION.classificationConfidence)}`}>
                  Classification : {DEMO_EXTRACTION.classificationConfidence}% confiance
                </span>
                <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${confidenceBadge(DEMO_EXTRACTION.overallConfidence)}`}>
                  Extraction : {DEMO_EXTRACTION.overallConfidence}% confiance
                </span>
                <span className="px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium">
                  {DEMO_EXTRACTION.detectedTaxYear} · {DEMO_EXTRACTION.detectedJurisdictionCode}
                </span>
                <span className="px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-xs">
                  OCR : {DEMO_EXTRACTION.ocrProvider}
                </span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {confirmedCount}/{fields.length} champs vérifiés
            </div>
          </div>

          {DEMO_EXTRACTION.needsHumanReview && !allConfirmed && (
            <div className="mt-4 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2">
              <span>⚠️</span>
              <span>Vérifiez les champs ci-dessous avant d'utiliser ces données dans votre déclaration.</span>
            </div>
          )}
        </div>

        {/* Règle fondamentale */}
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-800">
          <span className="text-lg mt-0.5">🔍</span>
          <div>
            <strong>Données extraites par OCR — pas encore validées.</strong>
            <br />Confirmez ou corrigez chaque champ. Les données ne seront utilisées dans votre déclaration qu'après validation.
          </div>
        </div>

        {/* Champs extraits */}
        {validated ? (
          <div className="bg-white rounded-2xl border border-green-200 p-8 text-center shadow-sm">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="font-bold text-gray-900 text-lg mb-2">Document validé</h2>
            <p className="text-gray-500 text-sm mb-4">
              Les données ont été validées et sont maintenant disponibles pour votre déclaration.
            </p>
            <Link href="/dossier" className="text-red-600 text-sm font-medium hover:underline">
              Retour à mon dossier →
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Données extraites — à vérifier
              </h2>
            </div>

            <div className="divide-y divide-gray-50">
              {fields.map((field) => (
                <div key={field.id} className={`px-6 py-4 ${field.needsReview && field.validationStatus === "unreviewed" ? "bg-yellow-50/40" : ""}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">{field.fieldCode}</span>
                        {field.isRequired && (
                          <span className="text-xs text-red-500">* requis</span>
                        )}
                        {field.needsReview && field.validationStatus === "unreviewed" && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">⚠️ à vérifier</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-2">{field.fieldLabel}</div>

                      {field.editMode ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={field.editValue ?? ""}
                            onChange={(e) =>
                              setFields((prev) =>
                                prev.map((f) =>
                                  f.id === field.id ? { ...f, editValue: e.target.value } : f
                                )
                              )
                            }
                            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 w-48"
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(field.id)}
                            className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700"
                          >
                            Sauvegarder
                          </button>
                          <button
                            onClick={() => setFields((prev) => prev.map((f) => f.id === field.id ? { ...f, editMode: false } : f))}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-gray-900 text-sm">
                            {field.validatedValue ?? field.rawOcrValue ?? "—"}
                          </span>
                          {field.validationStatus === "corrected" && (
                            <span className="text-xs text-blue-600">✏️ corrigé</span>
                          )}
                          {field.validationStatus === "confirmed" && (
                            <span className="text-xs text-green-600">✅ confirmé</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium ${confidenceColor(field.ocrConfidence)}`}>
                        {field.ocrConfidence}%
                      </span>
                      {field.validationStatus === "unreviewed" && !field.editMode && (
                        <>
                          <button
                            onClick={() => confirmField(field.id)}
                            className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            ✓ Confirmer
                          </button>
                          <button
                            onClick={() => startEdit(field.id)}
                            className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            ✏️ Corriger
                          </button>
                        </>
                      )}
                      {field.validationStatus !== "unreviewed" && !field.editMode && (
                        <button
                          onClick={() => startEdit(field.id)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Modifier
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Validation finale */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-gray-500">
                  En validant, vous confirmez que ces données sont correctes et autorisez leur utilisation dans votre déclaration.
                </p>
                <button
                  onClick={() => allConfirmed && setValidated(true)}
                  disabled={!allConfirmed}
                  className="bg-red-600 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  Valider les données →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
