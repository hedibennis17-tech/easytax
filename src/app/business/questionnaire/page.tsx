"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { NavClient } from "@/components/NavClient";
import { useApp } from "@/components/ThemeProvider";
import {
  ALL_BUSINESS_QUESTIONS,
  getAllBusinessQuestionsWithProvince,
  BUSINESS_SECTIONS,
  type Question,
} from "@/lib/questionnaire-business";
import type { QuestionOption } from "@/lib/questionnaire-individual";
import { saveDraftLocal, loadDraftLocal, formatLastSaved } from "@/lib/draft";

// ── Évaluation conditions ──────────────────────────────────
function evalCond(cond: string | undefined, ans: Record<string, unknown>): boolean {
  if (!cond) return true;
  const [key, val] = cond.split("=");
  const actual = String(ans[key] ?? "");
  if (val === "true")  return actual === "true"  || actual === "oui";
  if (val === "false") return actual === "false" || actual === "non";
  return actual === val;
}

// ── Champ BOOLEAN ─────────────────────────────────────────
function FieldBoolean({ value, onChange, lang }: { value: boolean | null; onChange: (v: boolean) => void; lang: string }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {([true, false] as const).map(v => (
        <button key={String(v)} onClick={() => onChange(v)} style={{
          flex: 1, padding: "12px 0", borderRadius: 9, fontSize: 14, fontWeight: 600,
          border: `1.5px solid ${value === v ? (v ? "#0b6b67" : "#526865") : "#dde8e5"}`,
          background: value === v ? (v ? "#0b6b67" : "#526865") : "#fff",
          color: value === v ? "#fff" : "#526865",
          cursor: "pointer", transition: "all 120ms",
        }}>
          {v ? (lang === "en" ? "Yes" : "Oui") : (lang === "en" ? "No" : "Non")}
        </button>
      ))}
    </div>
  );
}

// ── Champ SINGLE_CHOICE ───────────────────────────────────
function FieldSingle({ q, value, onChange, lang }: { q: Question; value: string; onChange: (v: string) => void; lang: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {(q.options ?? []).map((opt: QuestionOption) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: "11px 14px", borderRadius: 9, textAlign: "left", fontSize: 14,
          border: `1.5px solid ${value === opt.value ? "#0b6b67" : "#dde8e5"}`,
          background: value === opt.value ? "#f0faf8" : "#fff",
          color: value === opt.value ? "#0b6b67" : "#0f1f1e",
          fontWeight: value === opt.value ? 600 : 400,
          cursor: "pointer", transition: "all 120ms",
        }}>
          {lang === "en" ? opt.en : opt.fr}
        </button>
      ))}
    </div>
  );
}

// ── Champ MULTI_CHOICE ────────────────────────────────────
function FieldMulti({ q, value, onChange, lang }: { q: Question; value: string[]; onChange: (v: string[]) => void; lang: string }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {(q.options ?? []).map((opt: QuestionOption) => {
        const checked = value.includes(opt.value);
        return (
          <button key={opt.value} onClick={() => toggle(opt.value)} style={{
            padding: "11px 14px", borderRadius: 9, textAlign: "left", fontSize: 14,
            border: `1.5px solid ${checked ? "#0b6b67" : "#dde8e5"}`,
            background: checked ? "#f0faf8" : "#fff",
            color: checked ? "#0b6b67" : "#0f1f1e",
            cursor: "pointer", transition: "all 120ms",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${checked ? "#0b6b67" : "#dde8e5"}`, background: checked ? "#0b6b67" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {checked && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>✓</span>}
            </span>
            {lang === "en" ? opt.en : opt.fr}
          </button>
        );
      })}
    </div>
  );
}

// ── Champ TEXT / MONEY / NUMBER / DATE ────────────────────
function FieldInput({ type, q, value, onChange, onConfirm, lang }: { type: string; q: Question; value: string; onChange: (v: string) => void; onConfirm: () => void; lang: string }) {
  const btnLabel = lang === "en" ? "Continue" : "Continuer";
  const inputType = type === "MONEY" || type === "NUMBER" ? "number" : type === "DATE" ? "date" : "text";
  return (
    <div>
      {type === "MONEY" && (
        <div style={{ display: "flex", border: "1.5px solid #dde8e5", borderRadius: 9, overflow: "hidden", marginBottom: 10 }}>
          <span style={{ padding: "11px 13px", background: "#f7f9f8", fontWeight: 700, color: "#526865", fontSize: 14, borderRight: "1px solid #dde8e5" }}>$</span>
          <input type="number" value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter") onConfirm(); }} placeholder="0.00" min={0} step="0.01" autoFocus style={{ flex: 1, padding: "11px 13px", border: "none", fontSize: 14, outline: "none", background: "transparent" }} />
        </div>
      )}
      {type !== "MONEY" && (
        <input type={inputType} value={value} onChange={e => onChange(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && value.trim()) onConfirm(); }} placeholder={q.placeholder ?? ""} autoFocus
          style={{ width: "100%", padding: "11px 13px", borderRadius: 9, fontSize: 14, border: "1.5px solid #dde8e5", outline: "none", marginBottom: 10, boxSizing: "border-box" }}
          onFocus={e => (e.target.style.borderColor = "#0b6b67")} onBlur={e => (e.target.style.borderColor = "#dde8e5")}
        />
      )}
      <button onClick={onConfirm} disabled={!value.trim()} style={{ width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600, background: value.trim() ? "#0b6b67" : "#edf2f0", color: value.trim() ? "#fff" : "#a0b4b0", border: "none", cursor: "pointer" }}>
        {btnLabel}
      </button>
    </div>
  );
}

// ── PAGE PRINCIPALE ─────────────────────────────────────────
export default function BusinessQuestionnairePage() {
  const router = useRouter();
  const { lang } = useApp();
  const [answers,  setAnswers]  = useState<Record<string, unknown>>({});
  const [textVal,  setTextVal]  = useState("");
  const [multiVal, setMultiVal] = useState<string[]>([]);
  const [secIdx,   setSecIdx]   = useState(0);
  const [qIdx,     setQIdx]     = useState(0);
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);
  const [lastSaved,setLastSaved]= useState("");
  const [userId,   setUserId]   = useState("guest");
  const TAX_YEAR = "2025";
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/user/me").then(r => r.ok ? r.json() : null).then((d: {id?:string;role?:string}|null) => {
      if (d?.id) setUserId(d.id);
      if (d?.role && !["BUSINESS","ADMIN","SUPER_ADMIN"].includes(d.role)) router.replace("/dashboard");
    }).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (userId === "guest") return;
    const draft = loadDraftLocal(userId, `${TAX_YEAR}_biz`);
    if (draft && draft.status === "in_progress" && Object.keys(draft.answers).length > 0) {
      setAnswers(draft.answers);
      setSecIdx(draft.sectionIdx);
      setQIdx(draft.questionIdx);
      setLastSaved(formatLastSaved(draft.lastSavedAt));
    }
  }, [userId]);

  const ALL_QUESTIONS = getAllBusinessQuestionsWithProvince();
  const triageQs = ALL_BUSINESS_QUESTIONS.filter(q => q.section === "triage_biz").sort((a, b) => a.order - b.order);
  const triageDone = triageQs.every(q => answers[q.id] !== undefined);

  const visibleSections = BUSINESS_SECTIONS.filter(s =>
    s.code !== "triage_biz" && ((s as {alwaysShow?:boolean}).alwaysShow || evalCond((s as {showIf?:string}).showIf, answers))
  );
  const currentSection = visibleSections[secIdx];

  const triageProgress = {
    code: "triage_biz", fr: "Triage", en: "Triage", icon: "🧭",
    total: triageQs.length,
    answered: triageQs.filter(q => answers[q.id] !== undefined).length,
    pct: triageQs.length > 0 ? Math.round((triageQs.filter(q => answers[q.id] !== undefined).length / triageQs.length) * 100) : 0,
  };

  // Province d'exploitation: extraite des réponses triage (bi_province ou exploitation principale)
  const bizProvince = String(answers["biz_province"] ?? answers["bi_province"] ?? "");

  const sectionProgress = [triageProgress, ...visibleSections.map(s => {
    const sQs = ALL_QUESTIONS.filter(q =>
      q.section === s.code &&
      evalCond(q.showIf, answers) &&
      (!q.provinceOnly || !bizProvince || q.provinceOnly.includes(bizProvince))
    );
    const answered = sQs.filter(q => answers[q.id] !== undefined).length;
    return { code: s.code, fr: s.fr, en: s.en, icon: s.icon, total: sQs.length, answered, pct: sQs.length > 0 ? Math.round((answered / sQs.length) * 100) : 0 };
  })];

  const curSectionQs = triageDone
    ? ALL_QUESTIONS.filter(q => q.section === currentSection?.code && evalCond(q.showIf, answers)).sort((a, b) => a.order - b.order)
    : triageQs;

  const currentQ: Question | undefined = curSectionQs[qIdx];

  // COMPTEURS UNIFIÉS — même source que sectionProgress
  const visibleSectionCodes = new Set(visibleSections.map(s => s.code));
  const sectionApplicable = ALL_QUESTIONS.filter(q =>
    q.section !== "triage_biz" &&
    visibleSectionCodes.has(q.section) &&
    evalCond(q.showIf, answers) &&
    (!q.provinceOnly || !bizProvince || q.provinceOnly.includes(bizProvince))
  ).length;
  const totalApplicable = triageQs.length + sectionApplicable;
  // Compter seulement les réponses aux questions applicables
  const applicableIds = new Set([
    ...triageQs.map(q => q.id),
    ...ALL_QUESTIONS.filter(q =>
      q.section !== "triage_biz" &&
      visibleSectionCodes.has(q.section) &&
      evalCond(q.showIf, answers) &&
      (!q.provinceOnly || !bizProvince || q.provinceOnly.includes(bizProvince))
    ).map(q => q.id),
  ]);
  const totalAnswered = Object.keys(answers).filter(id => applicableIds.has(id)).length;
  const globalPct = totalApplicable > 0 ? Math.min(99, Math.round((totalAnswered / totalApplicable) * 100)) : 0;

  const resetInput = () => { setTextVal(""); setMultiVal([]); };

  const saveAndNext = useCallback(async (qId: string, value: unknown) => {
    const newAnswers = { ...answers, [qId]: value };
    setAnswers(newAnswers);
    setSaving(true);
    resetInput();

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveDraftLocal(userId, `${TAX_YEAR}_biz`, {
        answers: newAnswers, sectionIdx: secIdx, questionIdx: qIdx + 1,
        triageDone: triageQs.every(q => newAnswers[q.id] !== undefined),
      });
      setLastSaved(lang === "en" ? "Just now" : "À l'instant");
    }, 500);

    try { await fetch("/api/answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionCode: qId, answerValue: String(value), taxReturnId: "current", taxYearId: "2025" }) }); } catch { /* silencieux */ }
    setSaving(false);

    const newTriageDone = triageQs.every(q => newAnswers[q.id] !== undefined);
    const newDisplayQs = !newTriageDone ? triageQs
      : ALL_QUESTIONS.filter(q => q.section === currentSection?.code && evalCond(q.showIf, newAnswers)).sort((a, b) => a.order - b.order);

    const currentQPos = newDisplayQs.findIndex(q => q.id === qId);
    const nextIdx = currentQPos + 1;

    if (nextIdx < newDisplayQs.length) { setQIdx(nextIdx); }
    else if (newTriageDone) {
      const newVisibleSecs = BUSINESS_SECTIONS.filter(s => s.code !== "triage_biz" && ((s as {alwaysShow?:boolean}).alwaysShow || evalCond((s as {showIf?:string}).showIf, newAnswers)));
      const nextSecIdx = secIdx + 1;
      if (nextSecIdx < newVisibleSecs.length) { setSecIdx(nextSecIdx); setQIdx(0); }
      else setDone(true);
    }
  }, [answers, triageQs, currentSection, secIdx, qIdx, userId, lang, ALL_QUESTIONS]);

  const handleBack = () => { if (qIdx > 0) { setQIdx(i => i - 1); resetInput(); } else if (secIdx > 0) { setSecIdx(s => s - 1); setQIdx(0); resetInput(); } };

  const T = (fr: string, en: string) => lang === "en" ? en : fr;

  if (done) return (
    <div style={{ background: "#f7f9f8", minHeight: "100vh" }}>
      <NavClient />
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "32px 16px" }}>
        <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 16, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 22 }}>✓</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f1f1e", margin: "0 0 6px" }}>{T("Questionnaire terminé", "Questionnaire complete")}</h1>
          <p style={{ color: "#526865", fontSize: 14, margin: "0 0 20px" }}>{totalAnswered} {T("réponses enregistrées", "answers saved")}</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => router.push("/business")} style={{ flex: 1, padding: "12px 0", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer" }}>
              {T("Mon espace →", "My space →")}
            </button>
            <button onClick={() => { setDone(false); setSecIdx(0); setQIdx(0); }} style={{ padding: "12px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "#fff", color: "#526865", border: "1px solid #dde8e5", cursor: "pointer" }}>
              {T("Réviser", "Review")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: "#f7f9f8", minHeight: "100vh" }}>
      <NavClient />
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "20px 16px 80px" }}>

        {/* Progression globale */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#526865", marginBottom: 5 }}>
            <span>
              {!triageDone
                ? T("Quelques questions rapides pour commencer", "A few quick questions to start")
                : `${currentSection?.icon ?? ""} ${lang === "en" ? (currentSection?.en ?? "") : (currentSection?.fr ?? "")} — ${T("Déclaration 2025", "2025 Tax Return")}`}
            </span>
            <span style={{ fontWeight: 700, color: "#0b6b67" }}>{globalPct}%</span>
          </div>
          <div style={{ height: 3, background: "#dde8e5", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${globalPct}%`, background: "#0b6b67", borderRadius: 3, transition: "width 400ms ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontSize: 11, color: "#a0b4b0" }}>{totalAnswered} / {totalApplicable} {T("questions", "questions")}</span>
            {lastSaved && <span style={{ fontSize: 11, color: "#9fd4cc" }}>💾 {lastSaved}</span>}
          </div>
        </div>

        {/* Onglets scrollables */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 14, scrollbarWidth: "none" }}>
          <button onClick={() => { setSecIdx(0); setQIdx(0); resetInput(); }} style={{
            flexShrink: 0, padding: "5px 12px", borderRadius: 8, fontSize: 12,
            fontWeight: !triageDone ? 700 : 400, cursor: "pointer",
            background: !triageDone ? "#0b6b67" : triageProgress.pct === 100 ? "#f0faf8" : "#fff",
            color: !triageDone ? "#fff" : triageProgress.pct === 100 ? "#0b6b67" : "#526865",
            border: `1px solid ${!triageDone ? "#0b6b67" : triageProgress.pct === 100 ? "#9fd4cc" : "#dde8e5"}`,
            whiteSpace: "nowrap",
          }}>
            🧭 Triage {triageProgress.answered}/{triageProgress.total}{triageDone ? " ✓" : ""}
          </button>
          {visibleSections.map((s, i) => {
            const sp = sectionProgress.find(x => x.code === s.code);
            const active = triageDone && i === secIdx;
            const complete = (sp?.pct ?? 0) === 100 && (sp?.total ?? 0) > 0;
            return (
              <button key={s.code} onClick={() => { if (triageDone) { setSecIdx(i); setQIdx(0); resetInput(); } }} style={{
                flexShrink: 0, padding: "5px 12px", borderRadius: 8, fontSize: 12,
                fontWeight: active ? 700 : 400, cursor: triageDone ? "pointer" : "default",
                opacity: triageDone ? 1 : 0.4,
                background: active ? "#0b6b67" : complete ? "#f0faf8" : "#fff",
                color: active ? "#fff" : complete ? "#0b6b67" : "#526865",
                border: `1px solid ${active ? "#0b6b67" : complete ? "#9fd4cc" : "#dde8e5"}`,
                whiteSpace: "nowrap",
              }}>
                {s.icon} {lang === "en" ? s.en : s.fr}{sp && sp.total > 0 ? ` ${sp.answered}/${sp.total}` : ""}{complete && !active ? " ✓" : ""}
              </button>
            );
          })}
        </div>

        {/* Carte question */}
        {currentQ ? (
          <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "22px 20px", boxShadow: "0 1px 8px rgba(0,0,0,0.04)", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#9fd4cc", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {!triageDone ? "Triage" : (lang === "en" ? currentSection?.en : currentSection?.fr)}
                {currentQ.required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
              </span>
              <span style={{ fontSize: 11, color: "#a0b4b0" }}>{qIdx + 1} / {curSectionQs.length}</span>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f1f1e", margin: "0 0 8px", lineHeight: 1.4 }}>
              {lang === "en" ? currentQ.en : currentQ.fr}
            </h2>

            {(lang === "en" ? (currentQ.hintEn ?? currentQ.hint) : currentQ.hint) && (
              <p style={{ fontSize: 12, color: "#7a9c97", margin: "0 0 16px", lineHeight: 1.5 }}>
                {lang === "en" ? (currentQ.hintEn ?? currentQ.hint) : currentQ.hint}
              </p>
            )}

            {currentQ.documentRequired && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#0b6b67", background: "#f0faf8", border: "1px solid #b6ddd6", borderRadius: 8, padding: "7px 12px", marginBottom: 14 }}>
                📎 {T("Document requis", "Required document")} : <strong>{currentQ.documentRequired}</strong>
              </div>
            )}

            {currentQ.type === "BOOLEAN" && (
              <FieldBoolean value={answers[currentQ.id] === true ? true : answers[currentQ.id] === false ? false : null} onChange={v => saveAndNext(currentQ.id, v)} lang={lang} />
            )}
            {currentQ.type === "SINGLE_CHOICE" && (
              <FieldSingle q={currentQ} value={String(answers[currentQ.id] ?? "")} onChange={v => saveAndNext(currentQ.id, v)} lang={lang} />
            )}
            {currentQ.type === "MULTI_CHOICE" && (
              <div>
                <FieldMulti q={currentQ} value={multiVal} onChange={setMultiVal} lang={lang} />
                <button onClick={() => { if (multiVal.length > 0) saveAndNext(currentQ.id, multiVal.join(",")); }} disabled={multiVal.length === 0} style={{ width: "100%", padding: "11px 0", borderRadius: 9, fontSize: 14, fontWeight: 600, marginTop: 12, background: multiVal.length > 0 ? "#0b6b67" : "#edf2f0", color: multiVal.length > 0 ? "#fff" : "#a0b4b0", border: "none", cursor: "pointer" }}>
                  {T(`Confirmer (${multiVal.length})`, `Confirm (${multiVal.length})`)}
                </button>
              </div>
            )}
            {["TEXT","MONEY","NUMBER","DATE"].includes(currentQ.type) && (
              <FieldInput type={currentQ.type} q={currentQ} value={textVal} onChange={setTextVal} onConfirm={() => { if (textVal.trim()) saveAndNext(currentQ.id, textVal.trim()); }} lang={lang} />
            )}

            {!currentQ.required && !["BOOLEAN","SINGLE_CHOICE"].includes(currentQ.type) && (
              <button onClick={() => saveAndNext(currentQ.id, "skipped")} style={{ width: "100%", padding: "8px 0", borderRadius: 8, fontSize: 12, marginTop: 8, background: "transparent", color: "#a0b4b0", border: "1px dashed #dde8e5", cursor: "pointer" }}>
                {T("Passer cette question", "Skip this question")}
              </button>
            )}

            {saving && <div style={{ textAlign: "center", fontSize: 11, color: "#9fd4cc", marginTop: 8 }}>{T("Sauvegarde...", "Saving...")}</div>}
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "28px 20px", textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 20, color: "#9fd4cc", marginBottom: 8 }}>✓</div>
            <p style={{ color: "#526865", fontSize: 14 }}>{T("Section complète ou non applicable.", "Section complete or not applicable.")}</p>
            <button onClick={() => { const next = secIdx + 1; if (next < visibleSections.length) { setSecIdx(next); setQIdx(0); } else setDone(true); }} style={{ padding: "10px 22px", borderRadius: 9, fontSize: 13, fontWeight: 600, marginTop: 12, background: "#0b6b67", color: "#fff", border: "none", cursor: "pointer" }}>
              {T("Section suivante →", "Next section →")}
            </button>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <button onClick={handleBack} disabled={secIdx === 0 && qIdx === 0} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, background: "#fff", color: "#526865", border: "1px solid #dde8e5", cursor: "pointer", opacity: (secIdx === 0 && qIdx === 0) ? 0.4 : 1 }}>
            {T("← Précédent", "← Previous")}
          </button>
          <button onClick={() => router.push("/business")} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, background: "transparent", color: "#a0b4b0", border: "none", cursor: "pointer" }}>
            {T("Sauvegarder et quitter", "Save and exit")}
          </button>
        </div>

        {/* Progression par section */}
        {triageDone && sectionProgress.some(s => s.total > 0) && (
          <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#a0b4b0", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
              {T("Progression", "Progress")}
            </div>
            {sectionProgress.filter(s => s.total > 0).map(s => (
              <div key={s.code} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#526865", marginBottom: 3 }}>
                  <span>{s.icon} {lang === "en" ? s.en : s.fr}</span>
                  <span style={{ fontWeight: 600, color: s.pct === 100 ? "#059669" : "#526865" }}>{s.answered}/{s.total}</span>
                </div>
                <div style={{ height: 3, background: "#edf2f0", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.pct}%`, background: s.pct === 100 ? "#059669" : "#0b6b67", borderRadius: 3, transition: "width 300ms" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!triageDone && (
          <div style={{ background: "#fff", border: "1px solid #dde8e5", borderRadius: 14, padding: "14px 16px", fontSize: 13, color: "#7a9c97", textAlign: "center" }}>
            {T("Ces questions permettent de personnaliser votre questionnaire d'entreprise.", "These questions allow us to personalize your business questionnaire.")}
          </div>
        )}

      </div>
    </div>
  );
}
