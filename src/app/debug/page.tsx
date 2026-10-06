"use client";
import { useEffect, useState } from "react";

export default function DebugPage() {
  const [ls, setLs] = useState<Record<string, unknown>>({});
  const [sections, setSections] = useState<string>("");
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const all: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      try { all[k] = JSON.parse(localStorage.getItem(k)!); }
      catch { all[k] = localStorage.getItem(k); }
    }
    setLs(all);
    // Lire les sections depuis le brouillon
    const draftKey = Object.keys(all).find(k => k.startsWith("easytax_draft_"));
    if (draftKey) {
      const d = all[draftKey] as { version?: number; answers?: Record<string,unknown> };
      setSections(`Version brouillon: ${d.version ?? "AUCUNE"} | t0=${d.answers?.t0 ?? "NON RÉPONDU"}`);
    } else {
      setSections("Aucun brouillon trouvé");
    }
  }, [cleared]);

  const clearAll = () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("easytax_")) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
    setCleared(c => !c);
    alert(`✓ ${keys.length} clé(s) supprimée(s). Retourne au questionnaire.`);
  };

  return (
    <div style={{ padding: 20, fontFamily: "monospace", background: "#0f1f1e", color: "#9fd4cc", minHeight: "100vh" }}>
      <h1 style={{ color: "#fff", fontSize: 18 }}>🔧 EasyTax Debug</h1>
      
      <div style={{ background: "#1a2e2d", padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <b style={{ color: "#fff" }}>État brouillon:</b><br/>
        {sections}
      </div>

      <button onClick={clearAll} style={{ background: "#E5342A", color: "#fff", border: "none", padding: "12px 20px", borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: "pointer", marginBottom: 20, width: "100%" }}>
        🗑️ VIDER TOUT LE LOCALSTORAGE EASYTAX
      </button>

      <a href="/questionnaire" style={{ display: "block", background: "#0b6b67", color: "#fff", padding: "12px 20px", borderRadius: 8, fontSize: 14, fontWeight: 700, textAlign: "center", textDecoration: "none", marginBottom: 20 }}>
        → Aller au questionnaire
      </a>

      <div style={{ fontSize: 12 }}>
        <b style={{ color: "#fff" }}>Tout le localStorage ({Object.keys(ls).length} clés):</b>
        <pre style={{ background: "#0a1a19", padding: 10, borderRadius: 6, overflow: "auto", maxHeight: 400, fontSize: 11 }}>
          {JSON.stringify(ls, null, 2)}
        </pre>
      </div>
    </div>
  );
}
