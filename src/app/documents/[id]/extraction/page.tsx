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
  documentStatus: string;
  uploadedTypeCode: string | null;
  uploadedTypeLabelFr: string | null;
  detectedTypeCode: string | null;
  detectedTypeLabelFr: string | null;
  classificationConfidence: number | null;
  classificationReason: string | null;
  overallConfidence: number | null;
  detectedTaxYear: number | null;
  detectedJurisdictionCode: string | null;
  ocrProvider: string | null;
  needsHumanReview: boolean;
  errorMessage: string | null;
};

type OcrStatus = {
  status?: string;
  provider?: string;
  message?: string;
  code?: string | number | null;
  apiKeyConfigured?: boolean;
};

type Diagnostic = {
  ocr?: OcrStatus;
  mistral?: OcrStatus;
  google?: OcrStatus;
  diagnostic?: {
    status?: string;
    document?: { workflowStatus?: string };
    storage?: { status?: string };
    pages?: { count?: number; completed?: number; failed?: number; textDetected?: number };
    fields?: { total?: number; withValue?: number; reviewed?: number; averageConfidence?: number | null };
    lastFailure?: { message?: string } | null;
  };
};

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

function ConfidencePill({ value }: { value: number }) {
  const color =
    value >= 90 ? "bg-emerald-100 text-emerald-700" :
    value >= 75 ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {value}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed" || status === "corrected") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
        <svg className="size-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd"/>
        </svg>
        validé
      </span>
    );
  }
  return null;
}

export default function ExtractionPage() {
  const params = useParams<{ id?: string | string[] }>();
  const documentId = Array.isArray(params.id) ? params.id[0] ?? "" : params.id ?? "";
  const [data, setData] = useState<Extraction | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [error, setError] = useState("");
  const [validated, setValidated] = useState(false);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [diagnosticError, setDiagnosticError] = useState("");
  const [showDiagnostic, setShowDiagnostic] = useState(false);

  const load = async () => {
    if (!documentId) { setError("Identifiant du document manquant."); setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/extraction`, { cache: "no-store" });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(String(payload.error ?? "Le serveur n'a pas retourné l'extraction OCR."));
      if (!payload.extraction) throw new Error("Aucune extraction OCR disponible pour ce document.");
      setData(payload.extraction as Extraction);
      setFields(Array.isArray(payload.fields) ? payload.fields as Field[] : []);
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError, "Erreur de chargement de l'extraction."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const retryOcr = async (autoDetect = false) => {
    if (!documentId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/documents/${documentId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear: 2025, autoDetect }),
      });
      const payload = await responseJson(response);
      if (!response.ok || payload.status === "failed") throw new Error(String(payload.error ?? "Le traitement OCR n'a pas pu être relancé."));
      await load();
    } catch (retryError) {
      setError(errorMessage(retryError, "Le traitement OCR n'a pas pu être relancé."));
    } finally {
      setBusy(false);
    }
  };

  const runDiagnostic = async () => {
    if (!documentId) return;
    setDiagnosticError("");
    try {
      const response = await fetch(`/api/debug/ocr?documentId=${encodeURIComponent(documentId)}&probeGoogle=1`, { cache: "no-store" });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(response.status === 401 ? "Session expirée. Reconnectez-vous." : String(payload.error ?? "Diagnostic OCR indisponible."));
      setDiagnostic(payload as Diagnostic);
      setShowDiagnostic(true);
    } catch (e) {
      setDiagnosticError(errorMessage(e, "Diagnostic OCR indisponible."));
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
      if (!response.ok) throw new Error(String(payload.error ?? "Impossible d'enregistrer la correction."));
      setFields(current => current.map(item =>
        item.id === field.id
          ? { ...item, validatedValue: value, validationStatus: value === item.rawOcrValue ? "confirmed" : "corrected", needsReview: false, edit: undefined }
          : item
      ));
    } catch (saveError) {
      setError(errorMessage(saveError, "Impossible d'enregistrer la correction."));
    }
  };

  // Confirme toutes les boxes non-reviewées en parallèle
  const confirmAll = async () => {
    if (!documentId) return;
    const pending = fields.filter(f => f.validationStatus === "unreviewed" && f.edit === undefined);
    if (pending.length === 0) return;
    setConfirmingAll(true);
    setError("");
    try {
      await Promise.all(pending.map(f => save(f, f.validatedValue ?? f.rawOcrValue ?? "")));
    } catch (e) {
      setError(errorMessage(e, "Erreur lors de la confirmation groupée."));
    } finally {
      setConfirmingAll(false);
    }
  };

  const validate = async () => {
    if (!documentId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/validate`, { method: "POST" });
      const payload = await responseJson(response);
      if (!response.ok) throw new Error(String(payload.error ?? "Validation impossible."));
      setValidated(true); setError("");
    } catch (validationError) {
      setError(errorMessage(validationError, "Validation impossible."));
    } finally {
      setBusy(false);
    }
  };

  // ── États de chargement / erreur ─────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <div className="size-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-600" />
            <span className="text-sm">Chargement de l'extraction…</span>
          </div>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto mt-20 max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-red-100 text-red-600 text-2xl">⚠</div>
          <p className="font-medium text-slate-800">{error}</p>
          <p className="mt-2 text-sm text-slate-500">Le document est conservé. Vous pouvez relancer son analyse sans le re-téléverser.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => retryOcr()} disabled={busy} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50">
              {busy ? "Relance…" : "Relancer l'OCR"}
            </button>
            <button onClick={runDiagnostic} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Diagnostic OCR</button>
            <Link href="/dossier" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Dossier</Link>
          </div>
          {diagnosticError && <p className="mt-4 text-sm text-red-600">{diagnosticError}</p>}
        </div>
      </main>
    );
  }

  if (data?.documentStatus === "rejected") {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto mt-16 max-w-xl rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>
          <h1 className="mt-4 text-xl font-semibold text-slate-800">Type de feuillet non confirmé</h1>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700 text-left space-y-1">
            <p>Téléversement : <strong>{data.uploadedTypeLabelFr ?? data.uploadedTypeCode ?? "—"}</strong></p>
            <p>Détecté par OCR : <strong>{data.detectedTypeLabelFr ?? data.detectedTypeCode ?? "non identifié"}</strong></p>
          </div>
          {(data.errorMessage ?? data.classificationReason) && (
            <p className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-800">{data.errorMessage ?? data.classificationReason}</p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => retryOcr(true)} disabled={busy} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
              {busy ? "Analyse…" : "Analyser automatiquement"}
            </button>
            <Link href="/dossier" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">← Dossier</Link>
          </div>
        </div>
      </main>
    );
  }

  const confirmed = fields.filter(f => f.validationStatus !== "unreviewed").length;
  const pendingCount = fields.filter(f => f.validationStatus === "unreviewed").length;
  const allConfirmed = fields.length > 0 && confirmed === fields.length;
  const extractedValueCount = fields.filter(f => Boolean((f.validatedValue ?? f.rawOcrValue)?.trim())).length;
  const noExtractedValues = fields.length === 0 || fields.every(f => !(f.rawOcrValue ?? f.validatedValue)?.trim());
  const ocrInfo = diagnostic?.ocr ?? diagnostic?.mistral ?? null;

  const progressPct = fields.length > 0 ? Math.round((confirmed / fields.length) * 100) : 0;

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm px-5 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/dossier" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <svg className="size-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd"/></svg>
            Mon dossier
          </Link>
          {!validated && fields.length > 0 && (
            <span className="text-xs text-slate-400">{confirmed}/{fields.length} validés</span>
          )}
        </div>
      </nav>

      <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>⚠</span> {error}
          </div>
        )}

        {validated ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✅</div>
            <h1 className="text-2xl font-bold text-slate-800">Document validé</h1>
            <p className="mt-2 text-slate-500">Les montants sont maintenant dans vos revenus.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/questionnaire" className="rounded-xl bg-teal-600 px-5 py-2.5 font-medium text-white hover:bg-teal-700">Continuer →</Link>
              <Link href="/resume" className="rounded-xl border border-slate-200 px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50">Voir les revenus</Link>
            </div>
          </div>
        ) : (
          <>
            {/* Header feuillet */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-bold text-slate-900">{data?.detectedTypeLabelFr ?? data?.detectedTypeCode ?? "Document fiscal"}</h1>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${(data?.classificationConfidence ?? 0) >= 90 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      Type {data?.classificationConfidence ?? 0}%
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${(data?.overallConfidence ?? 0) >= 75 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      OCR {data?.overallConfidence ?? 0}%
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {extractedValueCount}/{fields.length} valeurs lues
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {data?.detectedTaxYear ?? "—"} · {data?.detectedJurisdictionCode ?? "CA"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                      {data?.ocrProvider ?? "OCR"}
                    </span>
                  </div>
                </div>
              </div>
              {data?.classificationReason && (
                <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800 leading-5">{data.classificationReason}</p>
              )}
            </section>

            {/* Barre de progression + bouton Tout confirmer */}
            {fields.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-700">Progression de la validation</span>
                      <span className="text-sm font-semibold text-slate-800">{progressPct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-teal-500 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">{confirmed} confirmé{confirmed > 1 ? "s" : ""} · {pendingCount} en attente</p>
                  </div>
                  {pendingCount > 0 && (
                    <button
                      onClick={confirmAll}
                      disabled={confirmingAll || busy}
                      className="flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      {confirmingAll ? (
                        <>
                          <div className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Confirmation…
                        </>
                      ) : (
                        <>
                          <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd"/>
                          </svg>
                          Tout confirmer ({pendingCount})
                        </>
                      )}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Notice */}
            <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              <svg className="size-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd"/></svg>
              Confirmez ou corrigez chaque valeur. Rien ne sera ajouté aux revenus avant la validation finale.
            </div>

            {noExtractedValues && (
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="font-semibold text-amber-900">Aucun montant trouvé</h2>
                <p className="mt-1.5 text-sm leading-6 text-amber-800">Relancez l'analyse — le parser lit maintenant les tableaux et le texte natif PDF.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => retryOcr()} disabled={busy} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
                    {busy ? "Analyse…" : "Relancer l'OCR"}
                  </button>
                  <button onClick={runDiagnostic} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800">Diagnostic</button>
                </div>
              </section>
            )}

            {/* Liste des cases */}
            {fields.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="divide-y divide-slate-100">
                  {fields.map(field => {
                    const hasValue = Boolean((field.validatedValue ?? field.rawOcrValue)?.trim());
                    const isValidated = field.validationStatus !== "unreviewed";
                    const isEditing = field.edit !== undefined;

                    return (
                      <div
                        key={field.id}
                        className={`group px-5 py-4 transition-colors ${
                          isValidated ? "bg-white" :
                          field.needsReview ? "bg-amber-50/40" :
                          "bg-white hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          {/* Infos case */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">
                                {field.fieldCode}
                              </span>
                              {field.isRequired && (
                                <span className="text-xs text-red-500 font-medium">requis</span>
                              )}
                              <StatusBadge status={field.validationStatus} />
                            </div>
                            <div className="mt-1 text-sm font-medium text-slate-800">{field.fieldLabel}</div>

                            {isEditing ? (
                              <div className="mt-2 flex gap-2">
                                <input
                                  autoFocus
                                  value={field.edit}
                                  onChange={e => setFields(c => c.map(i => i.id === field.id ? { ...i, edit: e.target.value } : i))}
                                  className="min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                                  placeholder="Valeur corrigée…"
                                />
                                <button
                                  onClick={() => save(field, field.edit ?? "")}
                                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => setFields(c => c.map(i => i.id === field.id ? { ...i, edit: undefined } : i))}
                                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className={`font-mono text-sm ${hasValue ? "text-slate-900 font-semibold" : "text-slate-300"}`}>
                                  {hasValue ? (field.validatedValue ?? field.rawOcrValue) : "—"}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          {!isEditing && (
                            <div className="flex shrink-0 items-center gap-2">
                              <ConfidencePill value={field.ocrConfidence} />
                              {!isValidated ? (
                                <>
                                  <button
                                    onClick={() => save(field, field.validatedValue ?? field.rawOcrValue ?? "")}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                                  >
                                    Confirmer
                                  </button>
                                  <button
                                    onClick={() => setFields(c => c.map(i => i.id === field.id ? { ...i, edit: i.validatedValue ?? i.rawOcrValue ?? "" } : i))}
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                                  >
                                    Corriger
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setFields(c => c.map(i => i.id === field.id ? { ...i, edit: i.validatedValue ?? i.rawOcrValue ?? "" } : i))}
                                  className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs text-slate-400 opacity-0 transition hover:bg-slate-50 hover:text-slate-600 group-hover:opacity-100"
                                >
                                  Modifier
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Diagnostic (collapsible) */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <button
                onClick={() => { void runDiagnostic(); }}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <span className="text-sm font-medium text-slate-700">Diagnostic OCR</span>
                  <p className="text-xs text-slate-400">Vérifie le provider, le stockage et les compteurs</p>
                </div>
                <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  Lancer
                </span>
              </button>
              {diagnosticError && <p className="mt-3 text-sm text-red-600">{diagnosticError}</p>}
              {showDiagnostic && diagnostic && (
                <div className="mt-4 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                  <p><span className="font-medium">Provider :</span> {ocrInfo?.provider ?? "—"} — {ocrInfo?.status ?? "configuré"}{ocrInfo?.message ? ` · ${ocrInfo.message}` : ""}</p>
                  <p><span className="font-medium">Document :</span> {diagnostic.diagnostic?.document?.workflowStatus ?? "inconnu"} · stockage {diagnostic.diagnostic?.storage?.status ?? "inconnu"}</p>
                  <p><span className="font-medium">Texte :</span> {diagnostic.diagnostic?.pages?.textDetected ?? 0}/{diagnostic.diagnostic?.pages?.count ?? 0} page(s) · {diagnostic.diagnostic?.fields?.withValue ?? 0}/{diagnostic.diagnostic?.fields?.total ?? 0} champs avec valeur</p>
                  {diagnostic.diagnostic?.lastFailure?.message && (
                    <p className="text-red-600"><span className="font-medium">Erreur :</span> {diagnostic.diagnostic.lastFailure.message}</p>
                  )}
                </div>
              )}
            </section>

            {/* Footer — Valider */}
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <div className="text-sm font-medium text-slate-700">
                  {allConfirmed ? "✅ Tout est validé" : `${confirmed}/${fields.length} champs validés`}
                </div>
                {!allConfirmed && (
                  <p className="text-xs text-slate-400">Confirmez ou corrigez toutes les valeurs pour continuer</p>
                )}
              </div>
              <button
                disabled={!allConfirmed || busy}
                onClick={validate}
                className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-40"
              >
                {busy ? "Validation…" : "Valider et ajouter au calcul →"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
