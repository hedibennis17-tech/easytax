"use client";
import { NavClient } from "@/components/NavClient";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ALL_INDIVIDUAL_QUESTIONS,
  INDIVIDUAL_SECTIONS,
  type Question,
} from "@/lib/questionnaire-individual";

// ── ÉVALUATION DES CONDITIONS ──────────────────────────────────────────────────
function evalCond(condition: string | undefined, answers: Record<string, unknown>): boolean {
  if (!condition) return true;
  const [key, val] = condition.split("=");
  const actual = String(answers[key] ?? "");
  if (val === "true")  return actual === "true"  || actual === "oui" || actual === "1";
  if (val === "false") return actual === "false" || actual === "non" || actual === "0";
  return actual === val;
}

// ── BLOC DOCUMENT (multi-feuillets) ───────────────────────────────────────────
interface DocSlot { id: string; label: string; status: "empty" | "uploading" | "done"; fileName?: string }

function DocumentBlock({ q, onDone }: { q: Question; onDone: () => void }) {
  const [slots, setSlots] = useState<DocSlot[]>([
    { id: "1", label: `${q.documentRequired ?? q.fr} — Feuillet 1`, status: "empty" },
  ]);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const addSlot = () => {
    const next = slots.length + 1;
    setSlots(s => [...s, { id: String(next), label: `${q.documentRequired ?? q.fr} — Feuillet ${next}`, status: "empty" }]);
  };

  const handleFile = (slotId: string, file: File) => {
    setSlots(s => s.map(slot =>
      slot.id === slotId ? { ...slot, status: "uploading" } : slot
    ));
    // Simuler l'upload + OCR (en prod: appel /api/documents/upload)
    setTimeout(() => {
      setSlots(s => s.map(slot =>
        slot.id === slotId ? { ...slot, status: "done", fileName: file.name } : slot
      ));
    }, 1200);
  };

  const removeSlot = (slotId: string) => {
    if (slots.length <= 1) return;
    setSlots(s => s.filter(slot => slot.id !== slotId));
  };

  const allDone = slots.every(s => s.status === "done");
  const hasDone  = slots.some(s => s.status === "done");

  return (
    <div>
      {/* Hint */}
      {q.hint && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
          {q.hint}
        </p>
      )}

      {/* Blocs feuillets */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
        {slots.map((slot) => (
          <div key={slot.id} style={{
            border: `2px dashed ${slot.status === "done" ? "rgba(22,163,74,0.4)" : "var(--border)"}`,
            borderRadius: 14, padding: "14px 16px",
            background: slot.status === "done" ? "rgba(22,163,74,0.05)" : "var(--bg-base)",
            transition: "all 200ms",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: slot.status === "empty" ? 10 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {slot.status === "done"
                  ? <span style={{ fontSize: 18 }}>✅</span>
                  : slot.status === "uploading"
                  ? <span style={{ fontSize: 18 }}>⏳</span>
                  : <span style={{ fontSize: 18 }}>📄</span>
                }
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    {slot.label}
                  </div>
                  {slot.status === "done" && slot.fileName && (
                    <div style={{ fontSize: 11, color: "#16A34A" }}>
                      {slot.fileName} — Téléversé ✓
                    </div>
                  )}
                  {slot.status === "uploading" && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Téléversement en cours...
                    </div>
                  )}
                </div>
              </div>
              {slots.length > 1 && slot.status !== "uploading" && (
                <button onClick={() => removeSlot(slot.id)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", padding: "4px 6px" }}>
                  ✕
                </button>
              )}
            </div>

            {slot.status === "empty" && (
              <div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.heic"
                  ref={el => { fileRefs.current[slot.id] = el; }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(slot.id, f); }}
                  style={{ display: "none" }}
                />
                <button
                  onClick={() => fileRefs.current[slot.id]?.click()}
                  style={{
                    width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: "var(--bg-card)", color: "var(--text-secondary)",
                    border: "1.5px solid var(--border)", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}>
                  📤 Choisir un fichier
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ajouter un feuillet supplémentaire */}
      <button onClick={addSlot}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: "transparent", color: "#2563EB",
          border: "1.5px dashed rgba(37,99,235,0.35)", cursor: "pointer",
          marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
        + Ajouter un feuillet supplémentaire
      </button>

      {/* Continuer */}
      <button
        onClick={onDone}
        style={{
          width: "100%", padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
          background: hasDone ? "var(--et-red)" : "var(--bg-card)",
          color: hasDone ? "#fff" : "var(--text-secondary)",
          border: hasDone ? "none" : "1.5px solid var(--border)",
          cursor: "pointer",
        }}>
        {hasDone ? "Continuer →" : "Ignorer ce document →"}
      </button>
    </div>
  );
}

// ── COMPOSANTS CHAMPS ──────────────────────────────────────────────────────────

function FieldBoolean({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {(["Oui", "Non"] as const).map((label) => {
        const v = label === "Oui";
        const selected = value === v;
        return (
          <button key={label} onClick={() => onChange(v)} style={{
            flex: 1, padding: "13px 0", borderRadius: 12, fontSize: 15, fontWeight: 600,
            background: selected ? (v ? "var(--et-red)" : "var(--bg-base)") : "var(--bg-base)",
            color: selected ? (v ? "#fff" : "var(--text-primary)") : "var(--text-secondary)",
            border: `2px solid ${selected ? (v ? "var(--et-red)" : "var(--text-primary)") : "var(--border)"}`,
            cursor: "pointer", transition: "all 120ms",
          }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function FieldSingleChoice({ q, value, onChange }: { q: Question; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(q.options ?? []).map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: "12px 16px", borderRadius: 12, textAlign: "left", fontSize: 14,
          fontWeight: value === opt.value ? 600 : 400,
          background: value === opt.value ? "rgba(229,52,42,0.07)" : "var(--bg-base)",
          color: value === opt.value ? "var(--et-red)" : "var(--text-secondary)",
          border: `2px solid ${value === opt.value ? "var(--et-red)" : "var(--border)"}`,
          cursor: "pointer", transition: "all 120ms",
        }}>
          {opt.fr}
        </button>
      ))}
    </div>
  );
}

function FieldMultiChoice({ q, value, onChange }: { q: Question; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(q.options ?? []).map((opt) => {
        const checked = value.includes(opt.value);
        return (
          <button key={opt.value} onClick={() => toggle(opt.value)} style={{
            padding: "11px 16px", borderRadius: 12, textAlign: "left", fontSize: 14,
            fontWeight: checked ? 600 : 400,
            background: checked ? "rgba(37,99,235,0.07)" : "var(--bg-base)",
            color: checked ? "#2563EB" : "var(--text-secondary)",
            border: `2px solid ${checked ? "#2563EB" : "var(--border)"}`,
            cursor: "pointer", transition: "all 120ms",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0,
              border: `2px solid ${checked ? "#2563EB" : "var(--border)"}`,
              background: checked ? "#2563EB" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {checked && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>✓</span>}
            </span>
            {opt.fr}
          </button>
        );
      })}
    </div>
  );
}

function FieldText({ q, value, onChange, onConfirm }: { q: Question; value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  return (
    <div>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onConfirm(); }}
        placeholder={q.placeholder ?? ""}
        autoFocus
        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
      <button onClick={onConfirm} disabled={!value.trim()} style={{
        width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
        background: value.trim() ? "var(--et-red)" : "var(--border)",
        color: value.trim() ? "#fff" : "var(--text-muted)", border: "none", cursor: "pointer",
      }}>Continuer →</button>
    </div>
  );
}

function FieldMoney({ q, value, onChange, onConfirm }: { q: Question; value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 12, background: "var(--bg-input)" }}>
        <span style={{ padding: "12px 14px", background: "var(--bg-card-hover)", fontWeight: 700, color: "var(--text-secondary)", fontSize: 15, borderRight: "1px solid var(--border)" }}>$</span>
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onConfirm(); }}
          placeholder="0,00" min={0} step="0.01" autoFocus
          style={{ flex: 1, padding: "12px 14px", border: "none", background: "transparent", color: "var(--text-primary)", fontSize: 15, outline: "none" }} />
      </div>
      <button onClick={onConfirm} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer" }}>
        Confirmer →
      </button>
    </div>
  );
}

function FieldNumber({ q, value, onChange, onConfirm }: { q: Question; value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  return (
    <div>
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") onConfirm(); }}
        placeholder={q.placeholder ?? "0"} min={0} autoFocus
        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 15, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
      <button onClick={onConfirm} disabled={!value} style={{
        width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
        background: value ? "var(--et-red)" : "var(--border)", color: value ? "#fff" : "var(--text-muted)", border: "none", cursor: "pointer",
      }}>Continuer →</button>
    </div>
  );
}

function FieldDate({ value, onChange, onConfirm }: { value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  return (
    <div>
      <input type="date" value={value} onChange={e => onChange(e.target.value)} autoFocus
        style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 15, outline: "none", marginBottom: 12, boxSizing: "border-box" }} />
      <button onClick={onConfirm} disabled={!value} style={{
        width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
        background: value ? "var(--et-red)" : "var(--border)", color: value ? "#fff" : "var(--text-muted)", border: "none", cursor: "pointer",
      }}>Continuer →</button>
    </div>
  );
}

function FieldAddress({ onConfirm }: { onConfirm: () => void }) {
  const fields = ["Numéro et rue", "Appartement / unité (optionnel)", "Ville", "Province / Territoire", "Code postal"];
  return (
    <div>
      {fields.map((label, i) => (
        <input key={i} type="text" placeholder={label}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
      ))}
      <button onClick={onConfirm} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer", marginTop: 4 }}>
        Confirmer l&apos;adresse →
      </button>
    </div>
  );
}

function FieldPerson({ q, onConfirm }: { q: Question; onConfirm: () => void }) {
  return (
    <div>
      {q.hint && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{q.hint}</p>}
      {["Nom complet", "NAS (optionnel, 9 chiffres)", "Date de naissance", "Revenu net 2025 ($)"].map((label, i) => (
        <input key={i} type={i === 2 ? "date" : i === 3 ? "number" : "text"} placeholder={label}
          style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
      ))}
      <button onClick={onConfirm} style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer", marginTop: 4 }}>
        Ajouter →
      </button>
    </div>
  );
}

// ── PAGE PRINCIPALE ────────────────────────────────────────────────────────────

export default function QuestionnairePage() {
  const router = useRouter();
  const [answers, setAnswers]   = useState<Record<string, unknown>>({});
  const [textVal,  setTextVal]  = useState("");
  const [numVal,   setNumVal]   = useState("");
  const [dateVal,  setDateVal]  = useState("");
  const [multiVal, setMultiVal] = useState<string[]>([]);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Redirect si pas INDIVIDUAL
  useEffect(() => {
    fetch("/api/user/me").then(r => r.ok ? r.json() : null).then(data => {
      if (data?.role && !["INDIVIDUAL"].includes(data.role)) {
        const map: Record<string, string> = { ADMIN: "/admin", SUPER_ADMIN: "/admin", BUSINESS: "/business", PREPARER: "/preparer" };
        router.replace(map[data.role] ?? "/dashboard");
      }
    }).catch(() => {});
  }, [router]);

  // Sections visibles
  const visibleSections = INDIVIDUAL_SECTIONS.filter(s =>
    (s as { alwaysShow?: boolean }).alwaysShow || evalCond((s as { showIf?: string }).showIf, answers)
  );

  const currentSection = visibleSections[sectionIdx];
  const sectionQuestions = ALL_INDIVIDUAL_QUESTIONS
    .filter(q => q.section === currentSection?.code && evalCond(q.showIf, answers))
    .sort((a, b) => a.order - b.order);

  const currentQ: Question | undefined = sectionQuestions[questionIdx];
  const totalAnswered = Object.keys(answers).length;
  const totalApplicable = ALL_INDIVIDUAL_QUESTIONS.filter(q => evalCond(q.showIf, answers)).length;
  const globalPct = totalApplicable > 0 ? Math.min(99, Math.round((totalAnswered / totalApplicable) * 100)) : 0;

  const resetInput = () => { setTextVal(""); setNumVal(""); setDateVal(""); setMultiVal([]); };

  const saveAndNext = useCallback(async (qId: string, value: unknown) => {
    const newAnswers = { ...answers, [qId]: value };
    setAnswers(newAnswers);
    setSaving(true);
    resetInput();
    try {
      await fetch("/api/answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionCode: qId, answerValue: String(value), taxReturnId: "current", taxYearId: "2025" }),
      });
    } catch { /* silencieux */ }
    setSaving(false);

    // Trouver la prochaine question dans la section ou passer à la section suivante
    const newSectionQs = ALL_INDIVIDUAL_QUESTIONS
      .filter(q => q.section === currentSection?.code && evalCond(q.showIf, newAnswers))
      .sort((a, b) => a.order - b.order);
    const currentQIndexInNew = newSectionQs.findIndex(q => q.id === qId);
    const nextIdx = currentQIndexInNew + 1;

    if (nextIdx < newSectionQs.length) {
      setQuestionIdx(nextIdx);
    } else {
      const newVisibleSections = INDIVIDUAL_SECTIONS.filter(s =>
        (s as { alwaysShow?: boolean }).alwaysShow || evalCond((s as { showIf?: string }).showIf, newAnswers)
      );
      const nextSecIdx = sectionIdx + 1;
      if (nextSecIdx < newVisibleSections.length) {
        setSectionIdx(nextSecIdx);
        setQuestionIdx(0);
      } else {
        setDone(true);
      }
    }
  }, [answers, currentSection, sectionIdx]);

  const handleBack = () => {
    if (questionIdx > 0) { setQuestionIdx(i => i - 1); resetInput(); }
    else if (sectionIdx > 0) { setSectionIdx(s => s - 1); setQuestionIdx(0); resetInput(); }
  };

  // ── ÉCRAN FIN ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
        <NavClient />
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "36px 28px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Questionnaire complété !</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: 24 }}>{totalAnswered} réponses · Progression {globalPct}%</p>
            <div style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#D97706", textAlign: "left" }}>
              ⚠️ Résultats préliminaires — aucune déclaration transmise.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => router.push("/documents")} style={{ flex: 1, padding: "13px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer" }}>
                Mes documents →
              </button>
              <button onClick={() => { setDone(false); setSectionIdx(0); setQuestionIdx(0); }} style={{ padding: "13px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer" }}>
                Réviser
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── VUE PRINCIPALE ─────────────────────────────────────────────────────────
  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavClient />
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* Barre de progression */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
            <span>{currentSection?.code === "triage" ? "🧭 Commençons — Déclaration 2025" : `${currentSection?.icon} ${currentSection?.fr} — Déclaration 2025`}</span>
            <span style={{ fontWeight: 700, color: "var(--et-red)" }}>{globalPct}%</span>
          </div>
          <div style={{ height: 5, background: "var(--border)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${globalPct}%`, background: "var(--et-red)", borderRadius: 100, transition: "width 400ms ease" }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
            {totalAnswered} / {totalApplicable} questions répondues
          </div>
        </div>

        {/* Onglets sections — Triage caché (interne) */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 18 }}>
          {visibleSections.filter(s => s.code !== "triage").map((s, i) => {
            const sQs = ALL_INDIVIDUAL_QUESTIONS.filter(q => q.section === s.code && evalCond(q.showIf, answers));
            const answered = sQs.filter(q => answers[q.id] !== undefined).length;
            const pct = sQs.length > 0 ? Math.round((answered / sQs.length) * 100) : 0;
            const active = i === sectionIdx;
            const complete = pct === 100 && sQs.length > 0;
            return (
              <button key={s.code}
                onClick={() => { setSectionIdx(i); setQuestionIdx(0); resetInput(); }}
                style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 9, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                  background: active ? "var(--et-red)" : complete ? "rgba(22,163,74,0.1)" : "var(--bg-card)",
                  color: active ? "#fff" : complete ? "#16A34A" : "var(--text-secondary)",
                  border: `1.5px solid ${active ? "var(--et-red)" : complete ? "rgba(22,163,74,0.35)" : "var(--border)"}`,
                  transition: "all 120ms",
                }}>
                {s.icon} {s.fr}{complete && !active ? " ✓" : ""}
              </button>
            );
          })}
        </div>

        {/* Carte question */}
        {currentQ ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "22px 20px", boxShadow: "var(--shadow-md)", marginBottom: 14 }}>
            {/* En-tête */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {currentSection?.icon} {currentSection?.fr}
                {currentQ.required && <span style={{ color: "var(--et-red)", marginLeft: 4 }}>*</span>}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {questionIdx + 1} / {sectionQuestions.length}
              </span>
            </div>

            {/* Question */}
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 6px", lineHeight: 1.4 }}>
              {currentQ.fr}
            </h2>

            {/* Hint — sauf DOCUMENT (il a son propre hint) */}
            {currentQ.hint && currentQ.type !== "DOCUMENT" && (
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.5 }}>{currentQ.hint}</p>
            )}

            {/* Badge document requis — sauf pour type DOCUMENT (le bloc le gère) */}
            {currentQ.documentRequired && currentQ.type !== "DOCUMENT" && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 9, padding: "7px 12px", marginBottom: 16, fontSize: 12, color: "#2563EB" }}>
                📎 Document requis : <strong>{currentQ.documentRequired}</strong>
              </div>
            )}

            {/* Champ selon le type */}
            {currentQ.type === "BOOLEAN" && (
              <FieldBoolean
                value={answers[currentQ.id] === true ? true : answers[currentQ.id] === false ? false : null}
                onChange={v => saveAndNext(currentQ.id, v)}
              />
            )}
            {currentQ.type === "SINGLE_CHOICE" && (
              <FieldSingleChoice q={currentQ}
                value={String(answers[currentQ.id] ?? "")}
                onChange={v => saveAndNext(currentQ.id, v)}
              />
            )}
            {currentQ.type === "MULTI_CHOICE" && (
              <div>
                <FieldMultiChoice q={currentQ} value={multiVal} onChange={setMultiVal} />
                <button onClick={() => { if (multiVal.length > 0) saveAndNext(currentQ.id, multiVal.join(",")); }}
                  disabled={multiVal.length === 0}
                  style={{ width: "100%", padding: "12px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, marginTop: 12,
                    background: multiVal.length > 0 ? "var(--et-red)" : "var(--border)",
                    color: multiVal.length > 0 ? "#fff" : "var(--text-muted)", border: "none", cursor: "pointer" }}>
                  Confirmer ({multiVal.length}) →
                </button>
              </div>
            )}
            {currentQ.type === "TEXT" && (
              <FieldText q={currentQ} value={textVal} onChange={setTextVal}
                onConfirm={() => { if (textVal.trim()) saveAndNext(currentQ.id, textVal.trim()); }} />
            )}
            {currentQ.type === "MONEY" && (
              <FieldMoney q={currentQ} value={numVal} onChange={setNumVal}
                onConfirm={() => saveAndNext(currentQ.id, numVal || "0")} />
            )}
            {currentQ.type === "NUMBER" && (
              <FieldNumber q={currentQ} value={numVal} onChange={setNumVal}
                onConfirm={() => { if (numVal) saveAndNext(currentQ.id, numVal); }} />
            )}
            {currentQ.type === "DATE" && (
              <FieldDate value={dateVal} onChange={setDateVal}
                onConfirm={() => { if (dateVal) saveAndNext(currentQ.id, dateVal); }} />
            )}
            {currentQ.type === "ADDRESS" && (
              <FieldAddress onConfirm={() => saveAndNext(currentQ.id, "adresse_confirmée")} />
            )}
            {currentQ.type === "PERSON" && (
              <FieldPerson q={currentQ} onConfirm={() => saveAndNext(currentQ.id, "personne_ajoutée")} />
            )}
            {currentQ.type === "DOCUMENT" && (
              <DocumentBlock q={currentQ} onDone={() => saveAndNext(currentQ.id, "document_handled")} />
            )}

            {/* Passer si optionnel (sauf DOCUMENT qui a son propre bouton ignorer) */}
            {!currentQ.required && currentQ.type !== "DOCUMENT" && currentQ.type !== "BOOLEAN" && currentQ.type !== "SINGLE_CHOICE" && (
              <button onClick={() => saveAndNext(currentQ.id, "skipped")}
                style={{ width: "100%", padding: "9px 0", borderRadius: 10, fontSize: 12, fontWeight: 500, marginTop: 10,
                  background: "transparent", color: "var(--text-muted)", border: "1px dashed var(--border)", cursor: "pointer" }}>
                Passer cette question →
              </button>
            )}

            {saving && <p style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>Sauvegarde...</p>}
          </div>
        ) : (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Section complète ou non applicable.</p>
            <button onClick={() => {
              const next = sectionIdx + 1;
              if (next < visibleSections.length) { setSectionIdx(next); setQuestionIdx(0); }
              else setDone(true);
            }} style={{ padding: "10px 22px", borderRadius: 12, fontSize: 14, fontWeight: 700, marginTop: 14, background: "var(--et-red)", color: "#fff", border: "none", cursor: "pointer" }}>
              Section suivante →
            </button>
          </div>
        )}

        {/* Nav bas */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <button onClick={handleBack} disabled={sectionIdx === 0 && questionIdx === 0}
            style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)", cursor: "pointer", opacity: (sectionIdx === 0 && questionIdx === 0) ? 0.4 : 1 }}>
            ← Précédent
          </button>
          <button onClick={() => router.push("/dossier")}
            style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer" }}>
            Sauvegarder et quitter
          </button>
        </div>

        {/* Progression par section — Triage caché */}
        <div style={{ marginTop: 18, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 18px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Progression par section
          </p>
          {visibleSections.filter(s => s.code !== "triage").map((s) => {
            const sQs = ALL_INDIVIDUAL_QUESTIONS.filter(q => q.section === s.code && evalCond(q.showIf, answers));
            if (sQs.length === 0) return null;
            const answered = sQs.filter(q => answers[q.id] !== undefined).length;
            const pct = Math.round((answered / sQs.length) * 100);
            return (
              <div key={s.code} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 3 }}>
                  <span>{s.icon} {s.fr}</span>
                  <span style={{ fontWeight: 600, color: pct === 100 ? "#16A34A" : "var(--text-secondary)" }}>{pct}%</span>
                </div>
                <div style={{ height: 3, background: "var(--border)", borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#16A34A" : "var(--et-red)", borderRadius: 100, transition: "width 300ms" }} />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
