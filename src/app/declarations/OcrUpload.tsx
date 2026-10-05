"use client";

import { useEffect, useRef, useState } from "react";

interface DocType { code: string; labelFr: string; category: string }
interface ExtField {
  id: string; fieldCode: string; fieldLabel: string | null;
  rawOcrValue: string | null; validatedValue: string | null;
  validationStatus: string; ocrConfidence: number | null;
}
interface Extraction {
  detectedTypeCode: string | null; detectedTypeLabelFr: string | null;
  detectedTaxYear: number | null; overallConfidence: number | null;
  documentStatus: string;
}

type Phase = "idle" | "uploading" | "processing" | "review" | "validating" | "done" | "error";

export function OcrUpload({ taxReturnId, taxYear, onValidated }: {
  taxReturnId: string | null; taxYear: number; onValidated: () => void;
}) {
  const [types, setTypes] = useState<DocType[]>([]);
  const [typeCode, setTypeCode] = useState("AUTO");
  const [phase, setPhase] = useState<Phase>("idle");
  const [phaseMsg, setPhaseMsg] = useState("");
  const [fields, setFields] = useState<ExtField[]>([]);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/documents/types").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d?.types) setTypes(d.types.map((t: { code: string; labelFr: string; category: string }) => ({
        code: t.code, labelFr: t.labelFr, category: t.category,
      })));
    }).catch(() => {});
  }, []);

  const reviewedCount = fields.filter((f) => f.validationStatus !== "unreviewed" || edits[f.id] !== undefined).length;

  const startUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setPhaseMsg("Choisis d'abord un fichier."); setPhase("error"); return; }
    setPhase("uploading"); setPhaseMsg("Téléversement…");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("documentTypeCode", typeCode);
      if (taxReturnId) form.append("taxReturnId", taxReturnId);
      const up = await fetch("/api/documents/upload", { method: "POST", body: form });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.message ?? upData.error ?? "Échec du téléversement");
      const id = upData.documentId ?? upData.id;
      setDocId(id);

      setPhase("processing"); setPhaseMsg("Analyse OCR en cours… (environ 20 secondes)");
      const pr = await fetch(`/api/documents/${id}/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxYear }),
      });
      const prData = await pr.json();
      if (!pr.ok) throw new Error(prData.error ?? "Échec de l'analyse OCR");

      const ex = await fetch(`/api/documents/${id}/extraction`);
      const exData = await ex.json();
      if (!ex.ok) throw new Error(exData.error ?? "Extraction introuvable");
      setExtraction(exData.extraction);
      setFields(exData.fields ?? []);
      setEdits({});
      setPhase("review");
    } catch (e) {
      setPhaseMsg(e instanceof Error ? e.message : "Erreur inconnue");
      setPhase("error");
    }
  };

  const confirmField = async (f: ExtField) => {
    const value = edits[f.id] ?? f.validatedValue ?? f.rawOcrValue ?? "";
    const res = await fetch(`/api/documents/${docId}/extraction`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fieldId: f.id, correctedValue: value }),
    });
    if (res.ok) {
      setFields((prev) => prev.map((x) => x.id === f.id
        ? { ...x, validatedValue: value, validationStatus: value === x.rawOcrValue ? "confirmed" : "corrected" }
        : x));
      setEdits((prev) => { const n = { ...prev }; delete n[f.id]; return n; });
    }
  };

  const validateAll = async () => {
    if (!docId) return;
    setPhase("validating"); setPhaseMsg("Validation du feuillet…");
    // Confirmer les champs restants avec leur valeur actuelle
    for (const f of fields) {
      if (f.validationStatus === "unreviewed" && edits[f.id] === undefined) {
        await confirmField(f);
      }
    }
    const res = await fetch(`/api/documents/${docId}/validate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setPhaseMsg(data.error ?? "Validation impossible");
      setPhase("error");
      return;
    }
    setPhase("done");
    setPhaseMsg(`Feuillet validé — ${data.entriesCreated ?? 0} écriture(s) ajoutée(s) au calcul.`);
    onValidated();
  };

  const reset = () => {
    setPhase("idle"); setPhaseMsg(""); setFields([]); setExtraction(null);
    setDocId(null); setEdits({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const card: React.CSSProperties = { background: "var(--bg-card)", border: "2px dashed #0b6b67", borderRadius: 14, padding: "18px 20px", marginBottom: 18 };

  return (
    <section style={card}>
      <h2 style={{ fontFamily: "Georgia,serif", fontSize: "1.25rem", margin: "0 0 4px", color: "var(--text-primary)" }}>
        📤 Ajouter un feuillet
      </h2>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 14px" }}>
        Téléverse n'importe quel feuillet — l'OCR extrait les cases dans un tableau que tu peux corriger avant de confirmer.
      </p>

      {phase === "idle" || phase === "error" ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.tiff"
            style={{ fontSize: 13, color: "var(--text-primary)" }} />
          <select value={typeCode} onChange={(e) => setTypeCode(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, maxWidth: 320 }}>
            {types.map((t) => <option key={t.code} value={t.code}>{t.code === "AUTO" ? "✨ " : ""}{t.labelFr}</option>)}
          </select>
          <button onClick={startUpload} disabled={!taxReturnId}
            style={{ padding: "10px 20px", background: "#0b6b67", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
            🔍 Analyser avec l'OCR
          </button>
          {phase === "error" && <span style={{ color: "#dc2626", fontSize: 13 }}>{phaseMsg}</span>}
        </div>
      ) : null}

      {(phase === "uploading" || phase === "processing" || phase === "validating") && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0" }}>
          <div style={{ width: 24, height: 24, border: "3px solid #dde8e5", borderTopColor: "#0b6b67", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <span style={{ fontSize: 14 }}>{phaseMsg}</span>
        </div>
      )}

      {phase === "review" && extraction && (
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {extraction.detectedTypeLabelFr ?? extraction.detectedTypeCode ?? "Feuillet"}
            </span>
            {extraction.detectedTaxYear && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>· {extraction.detectedTaxYear}</span>}
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              · {reviewedCount}/{fields.length} champs revus
            </span>
          </div>
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", padding: "8px 10px", borderBottom: "2px solid var(--border)" }}>Case</th>
                <th style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", padding: "8px 10px", borderBottom: "2px solid var(--border)" }}>Valeur OCR</th>
                <th style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--text-secondary)", padding: "8px 10px", borderBottom: "2px solid var(--border)" }}>Corriger</th>
                <th style={{ padding: "8px 10px", borderBottom: "2px solid var(--border)" }}></th>
              </tr></thead>
              <tbody>
                {fields.map((f) => {
                  const done = f.validationStatus !== "unreviewed";
                  const cur = edits[f.id] ?? f.validatedValue ?? f.rawOcrValue ?? "";
                  return (
                    <tr key={f.id}>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                        {f.fieldLabel ?? f.fieldCode}
                        {done && <span style={{ color: "#0b6b67", marginLeft: 6 }}>✓</span>}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: 13, color: "var(--text-secondary)" }}>
                        {f.rawOcrValue ?? "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                        <input
                          value={cur}
                          onChange={(e) => setEdits((p) => ({ ...p, [f.id]: e.target.value }))}
                          style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-base)", color: "var(--text-primary)", fontSize: 13, width: 140 }}
                        />
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)" }}>
                        {!done && (
                          <button onClick={() => confirmField(f)}
                            style={{ padding: "6px 12px", background: "#0b6b67", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            Confirmer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={validateAll}
              style={{ padding: "10px 20px", background: "#0b6b67", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              ✅ Valider le feuillet ({reviewedCount}/{fields.length})
            </button>
            <button onClick={reset}
              style={{ padding: "10px 16px", background: "none", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 9, cursor: "pointer", fontSize: 13 }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "#0b6b67", fontWeight: 700 }}>✓ {phaseMsg}</span>
          <button onClick={reset}
            style={{ padding: "10px 16px", background: "#0b6b67", color: "#fff", border: "none", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            ＋ Ajouter un autre feuillet
          </button>
        </div>
      )}
    </section>
  );
}
