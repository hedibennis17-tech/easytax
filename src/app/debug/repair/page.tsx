"use client";
import { useState } from "react";

export default function RepairPage() {
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function runFix() {
    setLoading(true);
    setLog([]);
    setResult(null);
    try {
      const res = await fetch("/api/diagnostic/fix", { method: "POST" });
      const data = await res.json();
      setLog(data.log ?? []);
      setResult(data.result ?? null);
      setDone(true);
    } catch (e) {
      setLog(["Erreur: " + String(e)]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "monospace", padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>🔧 Réparer mes données</h1>
      <p style={{ marginBottom: 20, color: "#555", fontSize: 14 }}>
        Supprime les entrées corrompues et re-synchronise tous les feuillets depuis le texte OCR.
      </p>
      <button
        onClick={runFix}
        disabled={loading || done}
        style={{
          background: done ? "#22c55e" : "#2563eb",
          color: "white",
          border: "none",
          borderRadius: 8,
          padding: "12px 24px",
          fontSize: 16,
          cursor: loading || done ? "default" : "pointer",
          width: "100%",
        }}
      >
        {loading ? "⏳ En cours..." : done ? "✅ Terminé" : "🔧 Lancer la réparation"}
      </button>

      {log.length > 0 && (
        <div style={{ marginTop: 20, background: "#f1f5f9", borderRadius: 8, padding: 16 }}>
          <strong>Log :</strong>
          <ul style={{ margin: "8px 0 0 0", padding: 0, listStyle: "none" }}>
            {log.map((l, i) => (
              <li key={i} style={{ fontSize: 13, padding: "2px 0", color: l.startsWith("✓") ? "#16a34a" : l.startsWith("Skip") ? "#6b7280" : "#1e293b" }}>
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, background: "#f0fdf4", borderRadius: 8, padding: 16, border: "1px solid #86efac" }}>
          <strong>Résultat :</strong>
          <p style={{ margin: "8px 0 0 0", fontSize: 14 }}>
            {result.incomeEntries as number} entrées · Total : <strong>{result.totalRevenus as string}</strong>
          </p>
          <div style={{ marginTop: 8 }}>
            {(result.entries as Array<{ cat: string; montant: string }>)?.map((e, i) => (
              <div key={i} style={{ fontSize: 13, color: "#166534" }}>• {e.cat} : {e.montant}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
