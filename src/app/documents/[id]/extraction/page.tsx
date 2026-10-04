"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Field = {
  id: string;
  fieldCode: string;
  fieldLabel: string;
  rawOcrValue: string | null;
  validatedValue: string | null;
  ocrConfidence: number;
  needsReview: boolean;
  isRequired: boolean;
  validationStatus: string;
  edit?: string;
};

type Extraction = {
  detectedTypeCode: string | null;
  detectedTypeLabelFr: string | null;
  classificationConfidence: number | null;
  overallConfidence: number | null;
  detectedTaxYear: number | null;
  detectedJurisdictionCode: string | null;
  ocrProvider: string | null;
  needsHumanReview: boolean;
};

type Diagnostic = {
  google?: {
    status?: string;
    provider?: string;
    message?: string;
    code?: string | number | null;
    processorType?: string | null;
    processorState?: string | null;
  };
  diagnostic?: {
    status?: string;
    document?: { workflowStatus?: string };
    storage?: { status?: string };
    pages?: { count?: number; completed?: number; failed?: number; textDetected?: number };
    fields?: { total?: number; withValue?: number; reviewed?: number; averageConfidence?: number | null };
    lastFailure?: { message?: string } | null;
  };
};

function badge(confidence: number) {
  if (confidence >= 90) return "border-green-200 bg-green-50 text-green-700";
  if (confidence >= 75) return "border-yellow-200 bg-yellow-50 text-yellow-700";
  return "border-red-200 bg-red-50 text-red-700";
}

async function responseJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Le serveur a retourné une réponse invalide.");
  }
}

function errorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("Failed query") || message.includes("params: undefined")) {
    return "Impossible de retrouver ce document. Retournez au dossier et sélectionnez-le de nouveau.";
  }
  return message;
}

export default function ExtractionPage() {
  const params = useParams<{ id?: string | string[] }>();
  const documentId = Array.isArray(params.id) ? params.id[0] ?? "" : params.id ?? "";
  const [data, setData] = useState<Extraction | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validated, setValidated] = useState(false);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [diagnosticError, setDiagnosticError] = useState("");

  const load = async () => {
    if (!documentId) {
      setError("Identifiant du document manquant.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/extraction`, { cache: "no-store" });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(String(payload.error ?? "Le serveur n’a pas retourné l’extraction OCR."));
      if (!payload.extraction) throw new Error("Aucune extraction OCR disponible pour ce document.");
      setData(payload.extraction as Extraction);
      setFields(Array.isArray(payload.fields) ? payload.fields as Field[] : []);
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError, "Erreur de chargement de l’extraction."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // documentId provient de la route dynamique.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const retryOcr = async () => {
    if (!documentId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: 2025 }),
      });
      const payload = await responseJson(response);
      if (!response.ok || payload.status === "failed") {
        throw new Error(String(payload.error ?? "Le traitement OCR n’a pas pu être relancé."));
      }
      await load();
    } catch (retryError) {
      setError(errorMessage(retryError, "Le traitement OCR n’a pas pu être relancé."));
    } finally {
      setBusy(false);
    }
  };

  const runDiagnostic = async () => {
    if (!documentId) return;
    setDiagnosticError("");
    try {
      const response = await fetch(
        `/api/debug/ocr?documentId=${encodeURIComponent(documentId)}&probeGoogle=1`,
        { cache: "no-store" },
      );
      const payload = await responseJson(response);
      if (!response.ok) {
        throw new Error(response.status === 401
          ? "La session EasyTax a expiré. Reconnectez-vous, puis réessayez le diagnostic depuis ce document."
          : String(payload.error ?? "Diagnostic OCR indisponible."));
      }
      setDiagnostic(payload as Diagnostic);
    } catch (diagnosticFailure) {
      setDiagnosticError(errorMessage(diagnosticFailure, "Diagnostic OCR indisponible."));
    }
  };

  const save = async (field: Field, value: string) => {
    if (!documentId) return;
    try {
      const response = await fetch(`/api/documents/${documentId}/extraction`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldId: field.id, correctedValue: value }),
      });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(String(payload.error ?? "Impossible d’enregistrer la correction."));
      setFields(current => current.map(item => item.id === field.id
        ? {
            ...item,
            validatedValue: value,
            validationStatus: value === item.rawOcrValue ? "confirmed" : "corrected",
            needsReview: false,
            edit: undefined,
          }
        : item));
    } catch (saveError) {
      setError(errorMessage(saveError, "Impossible d’enregistrer la correction."));
    }
  };

  const validate = async () => {
    if (!documentId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/validate`, { method: "POST" });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(String(payload.error ?? "Validation impossible."));
      setValidated(true);
      setError("");
    } catch (validationError) {
      setError(errorMessage(validationError, "Validation impossible."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-gray-50 p-8 text-center">Chargement de l’extraction OCR…</main>;
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 text-center text-red-700">
        <p>{error}</p>
        <p className="mt-3 text-sm text-gray-500">Le document est conservé. Vous pouvez relancer son analyse sans le téléverser à nouveau.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button onClick={retryOcr} disabled={busy} className="rounded-xl bg-teal-700 px-4 py-2 text-white disabled:opacity-50">
            {busy ? "Relance…" : "Relancer l’OCR"}
          </button>
          <button onClick={runDiagnostic} className="rounded-xl border border-teal-700 px-4 py-2 text-teal-800">
            Diagnostiquer l’OCR
          </button>
          <Link href="/dossier" className="rounded-xl border px-4 py-2 text-gray-700">Retour au dossier</Link>
        </div>
        {diagnosticError && <p className="mx-auto mt-4 max-w-xl text-sm text-red-700">{diagnosticError}</p>}
      </main>
    );
  }

  if (data?.ocrProvider === "mock") {
    return (
      <main className="min-h-screen bg-gray-50 p-8 text-center">
        <section className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h1 className="text-xl font-bold">Analyse de démonstration détectée</h1>
          <p className="mt-3 text-sm leading-6">Ce document a été traité avec le mode OCR mock. Les valeurs ne proviennent pas de votre fichier et ne peuvent pas être validées.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button onClick={retryOcr} disabled={busy} className="rounded-xl bg-teal-700 px-4 py-2 text-white disabled:opacity-50">
              {busy ? "Relance…" : "Relancer l’analyse réelle"}
            </button>
            <button onClick={runDiagnostic} className="rounded-xl border border-teal-700 px-4 py-2 text-teal-800">Diagnostiquer l’OCR</button>
            <Link href="/dossier" className="rounded-xl border px-4 py-2 text-gray-700">Retour au dossier</Link>
          </div>
        </section>
      </main>
    );
  }

  const confirmed = fields.filter(field => field.validationStatus !== "unreviewed").length;
  const allConfirmed = fields.length > 0 && confirmed === fields.length;
  const googleState = diagnostic?.google?.status ?? diagnostic?.google?.provider ?? null;

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <Link href="/dossier" className="text-sm text-gray-500">← Mon dossier</Link>
      </nav>
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {validated ? (
          <div className="rounded-2xl border border-green-200 bg-white p-10 text-center">
            <div className="mb-3 text-4xl">✅</div>
            <h1 className="text-xl font-bold">Document validé</h1>
            <p className="mt-2 text-gray-500">Les montants confirmés sont maintenant dans vos revenus et seront utilisés par le calcul fiscal.</p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/questionnaire" className="rounded-xl bg-teal-700 px-4 py-2 text-white">Continuer le questionnaire</Link>
              <Link href="/resume" className="rounded-xl border px-4 py-2">Voir les revenus</Link>
            </div>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border bg-white p-6">
              <h1 className="text-xl font-bold">{data?.detectedTypeLabelFr ?? data?.detectedTypeCode ?? "Document fiscal"}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full border px-2 py-1 ${badge(data?.classificationConfidence ?? 0)}`}>Type confirmé {data?.classificationConfidence ?? 0}%</span>
                <span className={`rounded-full border px-2 py-1 ${badge(data?.overallConfidence ?? 0)}`}>Extraction {data?.overallConfidence ?? 0}%</span>
                <span className="rounded-full border px-2 py-1">{data?.detectedTaxYear ?? "—"} · {data?.detectedJurisdictionCode ?? "Canada"}</span>
                <span className="rounded-full border px-2 py-1">OCR {data?.ocrProvider ?? "—"}</span>
              </div>
            </section>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              Confirmez ou corrigez chaque valeur. Rien ne sera ajouté aux revenus avant la validation finale.
            </div>

            {fields.length === 0 ? (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
                <h2 className="font-semibold">Aucun champ utilisable n’a été trouvé</h2>
                <p className="mt-2 text-sm leading-6">Le document reste conservé. Relancez l’analyse : le type choisi lors du téléversement sera utilisé en priorité et les cases du feuillet pourront ensuite être corrigées manuellement si nécessaire.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button onClick={retryOcr} disabled={busy} className="rounded-xl bg-teal-700 px-4 py-2 text-white disabled:opacity-50">
                    {busy ? "Analyse en cours…" : "Relancer l’OCR avec le type choisi"}
                  </button>
                  <button onClick={runDiagnostic} className="rounded-xl border border-teal-700 px-4 py-2 text-teal-800">Diagnostiquer l’OCR</button>
                </div>
              </section>
            ) : (
              <section className="divide-y rounded-2xl border bg-white">
                {fields.map(field => (
                  <div key={field.id} className={`p-5 ${field.needsReview ? "bg-yellow-50/50" : ""}`}>
                    <div className="flex flex-wrap justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-gray-400">{field.fieldCode} {field.isRequired && <span className="text-red-600">* requis</span>}</div>
                        <div className="mt-1 font-medium">{field.fieldLabel}</div>
                        {field.edit !== undefined ? (
                          <div className="mt-2 flex gap-2">
                            <input autoFocus value={field.edit} onChange={event => setFields(current => current.map(item => item.id === field.id ? { ...item, edit: event.target.value } : item))} className="min-w-0 rounded-lg border px-3 py-2" />
                            <button onClick={() => save(field, field.edit ?? "")} className="rounded-lg bg-teal-700 px-3 text-white">Enregistrer</button>
                          </div>
                        ) : (
                          <div className="mt-2 break-words font-mono">{field.validatedValue ?? field.rawOcrValue ?? "—"} {field.validationStatus !== "unreviewed" && <span className="text-xs text-green-600">✓ validé</span>}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{field.ocrConfidence}%</span>
                        {field.validationStatus === "unreviewed" && field.edit === undefined && (
                          <>
                            <button onClick={() => save(field, field.validatedValue ?? field.rawOcrValue ?? "")} className="rounded-lg border border-green-300 px-2 py-1 text-xs text-green-700">Confirmer</button>
                            <button onClick={() => setFields(current => current.map(item => item.id === field.id ? { ...item, edit: item.validatedValue ?? item.rawOcrValue ?? "" } : item))} className="rounded-lg border px-2 py-1 text-xs">Corriger</button>
                          </>
                        )}
                        {field.validationStatus !== "unreviewed" && field.edit === undefined && (
                          <button onClick={() => setFields(current => current.map(item => item.id === field.id ? { ...item, edit: item.validatedValue ?? item.rawOcrValue ?? "" } : item))} className="text-xs text-gray-500">Modifier</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <section className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-medium">Diagnostic OCR</h2>
                  <p className="text-sm text-gray-500">Vérifie Google, le stockage et les compteurs sans exposer vos montants.</p>
                </div>
                <button onClick={runDiagnostic} className="rounded-xl border border-teal-700 px-4 py-2 text-teal-800">Lancer le diagnostic</button>
              </div>
              {diagnosticError && <p className="mt-3 text-sm text-red-700">{diagnosticError}</p>}
              {diagnostic && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <p><strong>Google :</strong> {googleState ?? "état inconnu"}{diagnostic.google?.message ? ` — ${diagnostic.google.message}` : ""}</p>
                  <p><strong>Document :</strong> {diagnostic.diagnostic?.document?.workflowStatus ?? "inconnu"} · stockage {diagnostic.diagnostic?.storage?.status ?? "inconnu"}</p>
                  <p><strong>OCR :</strong> {diagnostic.diagnostic?.pages?.textDetected ?? 0}/{diagnostic.diagnostic?.pages?.count ?? 0} page(s) avec texte · {diagnostic.diagnostic?.fields?.withValue ?? 0}/{diagnostic.diagnostic?.fields?.total ?? 0} champ(s) avec valeur.</p>
                  {diagnostic.diagnostic?.lastFailure?.message && <p className="mt-2 text-red-700"><strong>Dernière erreur :</strong> {diagnostic.diagnostic.lastFailure.message}</p>}
                </div>
              )}
            </section>

            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-500">{confirmed}/{fields.length} champs validés</span>
              <button disabled={!allConfirmed || busy} onClick={validate} className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white disabled:opacity-40">
                {busy ? "Validation…" : "Valider et ajouter au calcul →"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
