"use client";
// NavWrapper importé côté client via dynamic pour éviter les erreurs SSR

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type AccountType = "INDIVIDUAL" | "BUSINESS";

const PROVINCES = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "Colombie-Britannique" },
  { value: "PE", label: "Île-du-Prince-Édouard" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "Nouveau-Brunswick" },
  { value: "NS", label: "Nouvelle-Écosse" },
  { value: "ON", label: "Ontario" },
  { value: "QC", label: "Québec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "NL", label: "Terre-Neuve-et-Labrador" },
  { value: "NT", label: "Territoires du Nord-Ouest" },
  { value: "NU", label: "Nunavut" },
  { value: "YT", label: "Yukon" },
];

// ── CSS variables fidèles au design original ──────────────────────────────────
const CSS = `
  .wz { font-family: "Avenir Next", Avenir, "Segoe UI", sans-serif; background: var(--bg-base); min-height: 100vh; }
  .wz-shell { width: min(1100px, 100%); margin: 0 auto; padding: 28px 20px 64px; }
  .topline { height: 4px; background: linear-gradient(90deg, #E5342A 0 20%, #0b6b67 20% 100%); border-radius: 99px; margin-bottom: 22px; }
  .wz input, .wz select, .wz textarea { width: 100%; border: 1px solid var(--border); border-radius: 9px; background: var(--bg-base); color: var(--text-primary); padding: 11px 13px; min-height: 46px; font: inherit; outline: none; box-sizing: border-box; }
  .wz input:focus, .wz select:focus, .wz textarea:focus { border-color: #0b6b67; box-shadow: 0 0 0 3px rgba(11,107,103,0.12); }
  .wz label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px; color: var(--text-primary); }
  .wz .opt { color: var(--text-muted); font-size: 12px; font-weight: 400; }
  .wz .hint { font-size: 12px; color: var(--text-muted); margin: 5px 0 0; }
  .wz .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .wz .span2 { grid-column: span 2; }
  .wz .sec-title { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 24px 0 12px; padding-top: 20px; border-top: 1px solid var(--border); }
  .wz .check-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
  .wz .check-opt { display: flex; gap: 9px; align-items: flex-start; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-base); font-size: 13px; cursor: pointer; }
  .wz .check-opt input { width: 16px; min-height: 16px; accent-color: #0b6b67; flex-shrink: 0; margin-top: 1px; }
  .wz .add-btn { margin-top: 12px; border: 1.5px dashed #0b6b67; color: #0b6b67; background: transparent; padding: 11px 16px; border-radius: 9px; font-weight: 700; cursor: pointer; font: inherit; font-size: 13px; }
  .wz .member-card { border: 1px solid var(--border); border-radius: 13px; padding: 18px; background: var(--bg-card); margin-bottom: 12px; }
  .wz .member-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .wz .remove-btn { border: 0; background: transparent; color: #E5342A; cursor: pointer; font-weight: 700; font: inherit; font-size: 13px; }
  .wz .review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  .wz .review-block { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
  .wz .review-block h3 { margin: 0 0 12px; font-size: 14px; font-weight: 700; color: var(--text-primary); }
  .wz .review-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 5px 0; border-bottom: 1px solid var(--border); }
  .wz .review-row:last-child { border: none; }
  .wz .review-row span:first-child { color: var(--text-muted); }
  .wz .review-row span:last-child { font-weight: 600; color: var(--text-primary); text-align: right; }
  .wz .consent-box { display: flex; gap: 10px; align-items: flex-start; padding: 13px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 10px; font-size: 13px; }
  .wz .consent-box input { width: 16px; min-height: 16px; accent-color: #0b6b67; flex-shrink: 0; margin-top: 2px; }
  @media (max-width: 720px) {
    .wz .grid2, .wz .check-grid, .wz .review-grid { grid-template-columns: 1fr; }
    .wz .span2 { grid-column: auto; }
    .wz-shell { padding: 16px 14px 40px; }
  }
`;

// ── CHOIX INITIAL ─────────────────────────────────────────────────────────────
function Chooser({ onChoose }: { onChoose: (t: AccountType) => void }) {
  return (
    <div>
      <div style={{ maxWidth: 680, padding: "36px 0 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#0b6b67", fontWeight: 700, marginBottom: 18, fontSize: 14 }}>
          <span style={{ width: 16, height: 16, borderRadius: "3px 3px 6px 3px", background: "#E5342A", transform: "rotate(-5deg)", display: "inline-block" }} />
          EasyTax CANADA
        </div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(2rem,5vw,3.5rem)", margin: "0 0 12px", lineHeight: 1.1, color: "var(--text-primary)" }}>
          Quel espace souhaitez&#8209;vous créer&nbsp;?
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 16, margin: 0, maxWidth: 560 }}>
          Choisissez un contexte fiscal. Vos renseignements personnels et ceux de votre entreprise demeurent dans des espaces distincts.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 36 }}>
        {([
          {
            type: "INDIVIDUAL" as AccountType,
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={30} height={30}>
                <circle cx={12} cy={8} r={4}/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            ),
            title: "Compte personnel",
            desc: "Pour vous-même et les membres de votre famille : profil fiscal, coordonnées et situation familiale.",
            cta: "Créer mon espace →",
          },
          {
            type: "BUSINESS" as AccountType,
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={30} height={30}>
                <rect x={2} y={7} width={20} height={14} rx={2}/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            ),
            title: "Compte entreprise",
            desc: "Pour une société ou un travailleur autonome : immatriculation, fiscalité, taxes et personnes-ressources.",
            cta: "Créer l'entreprise →",
          },
        ] as const).map(({ type, icon, title, desc, cta }) => (
          <button key={type} onClick={() => onChoose(type)} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18,
            padding: "28px", textAlign: "left", cursor: "pointer", minHeight: 240,
            display: "flex", flexDirection: "column", transition: "all 200ms",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#0b6b67"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
          >
            <div style={{ width: 54, height: 54, display: "grid", placeItems: "center", borderRadius: 16, background: "rgba(11,107,103,0.1)", color: "#0b6b67" }}>
              {icon}
            </div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 26, margin: "20px 0 8px", color: "var(--text-primary)" }}>{title}</h2>
            <p style={{ color: "var(--text-secondary)", margin: "0 0 24px", fontSize: 14, lineHeight: 1.5 }}>{desc}</p>
            <div style={{ marginTop: "auto", color: "#0b6b67", fontWeight: 700, display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>{cta}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", color: "var(--text-muted)", fontSize: 13 }}>
        {["Parcours guidé", "Renseignements séparés par contexte", "Révision avant inscription"].map(p => (
          <div key={p} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0b6b67" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RAIL DE NAVIGATION ────────────────────────────────────────────────────────
function StepRail({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 12, position: "sticky", top: 16, minWidth: 220 }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "32px 1fr", gap: 10, alignItems: "center",
            padding: "9px 10px", borderRadius: 10, marginBottom: 4,
            background: active ? "rgba(11,107,103,0.1)" : "transparent",
            color: active ? "#084d4a" : done ? "#0b6b67" : "var(--text-muted)",
            fontWeight: active ? 700 : 400,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center",
              fontSize: 12, fontWeight: 700,
              background: (active || done) ? "#0b6b67" : "var(--bg-base)",
              color: (active || done) ? "#fff" : "var(--text-muted)",
              border: `1px solid ${(active || done) ? "#0b6b67" : "var(--border)"}`,
            }}>
              {done ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 13 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── CARD D'ÉTAPE ──────────────────────────────────────────────────────────────
function StepCard({ num, title, desc, children }: { num: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ padding: "28px 28px 0" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", paddingBottom: 20, borderBottom: "1px solid var(--border)", marginBottom: 22 }}>
          <span style={{ color: "#0b6b67", fontWeight: 700, paddingTop: 4, fontSize: 14, flexShrink: 0 }}>0{num}</span>
          <div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 26, margin: "0 0 4px", color: "var(--text-primary)" }}>{title}</h2>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>{desc}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── ACTIONS BAS ────────────────────────────────────────────────────────────────
function Actions({ onBack, onNext, nextLabel = "Continuer →", saving = false, nextDisabled = false }: {
  onBack?: () => void; onNext: () => void; nextLabel?: string; saving?: boolean; nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "18px 28px", borderTop: "1px solid var(--border)", background: "var(--bg-base)" }}>
      {onBack ? (
        <button onClick={onBack} style={{ border: "1px solid var(--border)", borderRadius: 9, minHeight: 44, padding: "10px 18px", fontWeight: 700, cursor: "pointer", background: "transparent", color: "var(--text-secondary)", font: "inherit" }}>
          ← Précédent
        </button>
      ) : <div />}
      <button onClick={onNext} disabled={saving || nextDisabled} style={{
        border: 0, borderRadius: 9, minHeight: 44, padding: "11px 24px", fontWeight: 700,
        cursor: (saving || nextDisabled) ? "not-allowed" : "pointer",
        background: (saving || nextDisabled) ? "var(--border)" : "#0b6b67",
        color: (saving || nextDisabled) ? "var(--text-muted)" : "#fff", font: "inherit", fontSize: 14,
        opacity: nextDisabled ? 0.6 : 1,
      }}>
        {saving ? "Enregistrement..." : nextLabel}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// WIZARD INDIVIDUEL — 7 étapes
// ════════════════════════════════════════════════════════════════════════════════

const IND_STEPS = ["Identité", "Coordonnées", "Profil fiscal", "Famille", "Consentements", "Révision", "Inscription"];

interface FamilyMember {
  id: number; relation: string; firstName: string; lastName: string;
  birthDate: string; nas: string; income: string; custody: string;
}

function IndividualWizard({ onBack, onDone, prefill }: {
  onBack: () => void;
  onDone: (data: Record<string, unknown>) => void;
  prefill: { firstName?: string; lastName?: string; email?: string };
}) {
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");

  // Étape 1
  const [firstName, setFirstName]         = useState(prefill.firstName ?? "");
  const [lastName,  setLastName]          = useState(prefill.lastName ?? "");
  const [otherNames, setOtherNames]       = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [birthDate, setBirthDate]         = useState("");
  const [nas,       setNas]              = useState("");
  const [canadaStatus, setCanadaStatus]  = useState("");
  const [gender,    setGender]            = useState("");

  // Étape 2
  const [email,    setEmail]    = useState(prefill.email ?? "");
  const [phone,    setPhone]    = useState("");
  const [address,  setAddress]  = useState("");
  const [city,     setCity]     = useState("");
  const [province, setProvince] = useState("QC");
  const [postal,   setPostal]   = useState("");
  const [language, setLanguage] = useState("fr");
  const [contactPref, setContactPref] = useState("email");

  // Étape 3
  const [marital,      setMarital]      = useState("");
  const [maritalDate,  setMaritalDate]  = useState("");
  const [taxProvince,  setTaxProvince]  = useState("QC");
  const [taxYear,      setTaxYear]      = useState("2025");
  const [arrivalDate,  setArrivalDate]  = useState("");
  const [departDate,   setDepartDate]   = useState("");
  const [movedProvince, setMovedProvince] = useState("");
  const [prevProvince, setPrevProvince] = useState("");
  const [northernResident, setNorthernResident] = useState("");
  const [situations,   setSituations]   = useState<string[]>([]);

  // Étape 4 — Famille
  const [members, setMembers] = useState<FamilyMember[]>([]);

  // Étape 5
  const [preparer,   setPreparer]   = useState("");
  const [consent1,   setConsent1]   = useState(false);
  const [consent2,   setConsent2]   = useState(false);

  const toggleSituation = (v: string) =>
    setSituations(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]);

  const addMember = () => setMembers(m => [...m, {
    id: Date.now(), relation: "", firstName: "", lastName: "",
    birthDate: "", nas: "", income: "", custody: ""
  }]);

  const removeMember = (id: number) => setMembers(m => m.filter(x => x.id !== id));
  const updateMember = (id: number, field: string, val: string) =>
    setMembers(m => m.map(x => x.id === id ? { ...x, [field]: val } : x));

  const validate = (): boolean => {
    setErr("");
    if (step === 0 && (!firstName || !lastName || !birthDate || !canadaStatus)) {
      setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false;
    }
    if (step === 1 && (!email || !province)) {
      setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false;
    }
    if (step === 2 && (!marital || !taxProvince || !taxYear)) {
      setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false;
    }
    if (step === 4 && (!consent1 || !consent2 || !preparer)) {
      setErr("Veuillez confirmer les deux déclarations et votre choix de préparation."); return false;
    }
    return true;
  };

  const next = () => { if (!validate()) return; if (step < 6) setStep(s => s + 1); };
  const back = () => { setErr(""); if (step === 0) onBack(); else setStep(s => s - 1); };

  const allData = {
    type: "INDIVIDUAL", firstName, lastName, otherNames, preferredName, birthDate, nas, canadaStatus, gender,
    email, phone, address, city, province, postal, language, contactPref,
    marital, maritalDate, taxProvince, taxYear, arrivalDate, departDate, movedProvince, prevProvince, northernResident, situations,
    members, preparer,
  };

  const F = ({ label, opt, hint, children }: { label: string; opt?: boolean; hint?: string; children: React.ReactNode }) => (
    <div>
      <label>{label} {opt && <span className="opt">(facultatif)</span>}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", margin: "0 0 6px", color: "var(--text-primary)" }}>
            Votre espace personnel
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>Profil fiscal du titulaire et de sa famille</p>
        </div>
        <button onClick={onBack} style={{ border: 0, background: "transparent", color: "#0b6b67", fontWeight: 700, cursor: "pointer", font: "inherit", fontSize: 13, padding: "8px 2px", whiteSpace: "nowrap" }}>
          Changer de type
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <div className="hide-mobile">
          <StepRail steps={IND_STEPS} current={step} />
        </div>

        <div>
          {/* Progression mobile */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", padding: "12px 16px", borderRadius: 14, marginBottom: 14, display: "none" }} className="show-mobile">
            <strong style={{ fontSize: 13 }}>Étape {step + 1} sur {IND_STEPS.length} — {IND_STEPS[step]}</strong>
            <div style={{ height: 5, borderRadius: 99, background: "var(--border)", overflow: "hidden", marginTop: 8 }}>
              <div style={{ height: "100%", width: `${((step) / (IND_STEPS.length - 1)) * 100}%`, background: "#0b6b67", transition: "width 250ms" }} />
            </div>
          </div>

          {err && <div style={{ background: "rgba(229,52,42,0.08)", border: "1px solid rgba(229,52,42,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "var(--et-red)" }}>⚠️ {err}</div>}

          {/* ── ÉTAPE 1 : Identité ──────────────────────────────── */}
          {step === 0 && (
            <StepCard num={1} title="Identité du titulaire" desc="Les renseignements tels qu'ils figurent sur vos documents officiels.">
              <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
                <F label="Prénom légal *"><input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Marie" autoFocus /></F>
                <F label="Nom de famille légal *"><input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Tremblay" /></F>
                <F label="Autres prénoms" opt><input value={otherNames} onChange={e => setOtherNames(e.target.value)} placeholder="Anne" /></F>
                <F label="Prénom préféré" opt><input value={preferredName} onChange={e => setPreferredName(e.target.value)} placeholder="Marie" /></F>
                <F label="Date de naissance *"><input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} /></F>
                <F label="Numéro d'assurance sociale *" hint="9 chiffres. Sera chiffré lors de l'intégration sécurisée.">
                  <input value={nas} onChange={e => setNas(e.target.value)} placeholder="••• ••• •••" maxLength={11} />
                </F>
                <F label="Statut au Canada *">
                  <select value={canadaStatus} onChange={e => setCanadaStatus(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Citoyen canadien</option>
                    <option>Résident permanent</option>
                    <option>Résident temporaire</option>
                    <option>Personne protégée</option>
                    <option>Autre statut</option>
                  </select>
                </F>
                <F label="Genre" opt>
                  <select value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">Préférer ne pas répondre</option>
                    <option>Femme</option><option>Homme</option>
                    <option>Non binaire</option><option>Autre</option>
                  </select>
                </F>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 2 : Coordonnées ───────────────────────────── */}
          {step === 1 && (
            <StepCard num={2} title="Coordonnées" desc="Votre adresse principale et les moyens de vous joindre.">
              <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
                <F label="Adresse courriel *"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@exemple.ca" autoFocus /></F>
                <F label="Téléphone principal" opt><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(514) 555-0000" /></F>
                <div className="span2"><F label="Adresse" opt><input value={address} onChange={e => setAddress(e.target.value)} placeholder="123, rue Principale" /></F></div>
                <F label="Ville" opt><input value={city} onChange={e => setCity(e.target.value)} placeholder="Montréal" /></F>
                <F label="Province ou territoire *">
                  <select value={province} onChange={e => setProvince(e.target.value)}>
                    {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </F>
                <F label="Code postal" opt><input value={postal} onChange={e => setPostal(e.target.value)} placeholder="H1A 1A1" /></F>
                <F label="Langue de communication *">
                  <select value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </F>
                <F label="Préférence de contact" opt>
                  <select value={contactPref} onChange={e => setContactPref(e.target.value)}>
                    <option value="email">Courriel</option>
                    <option value="phone">Téléphone</option>
                    <option value="both">Les deux</option>
                  </select>
                </F>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 3 : Profil fiscal ─────────────────────────── */}
          {step === 2 && (
            <StepCard num={3} title="Profil fiscal" desc="Quelques repères pour configurer votre dossier correctement.">
              <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
                <F label="État civil *">
                  <select value={marital} onChange={e => setMarital(e.target.value)} autoFocus>
                    <option value="">Sélectionner</option>
                    <option>Célibataire</option><option>Marié(e)</option>
                    <option>Conjoint(e) de fait</option><option>Séparé(e)</option>
                    <option>Divorcé(e)</option><option>Veuf ou veuve</option>
                  </select>
                </F>
                <F label="Date du changement d'état civil" opt hint="S'il y a lieu">
                  <input type="date" value={maritalDate} onChange={e => setMaritalDate(e.target.value)} />
                </F>
                <F label="Province de résidence fiscale au 31 décembre *">
                  <select value={taxProvince} onChange={e => setTaxProvince(e.target.value)}>
                    {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </F>
                <F label="Première année fiscale à préparer *">
                  <select value={taxYear} onChange={e => setTaxYear(e.target.value)}>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="other">Année antérieure</option>
                  </select>
                </F>
                <F label="Date d'arrivée au Canada" opt hint="S'il y a lieu">
                  <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} />
                </F>
                <F label="Date de départ du Canada" opt hint="S'il y a lieu">
                  <input type="date" value={departDate} onChange={e => setDepartDate(e.target.value)} />
                </F>
                <F label="Province précédente" opt><select value={prevProvince} onChange={e => setPrevProvince(e.target.value)}><option value="">Non applicable</option>{PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></F>
                <F label="Province d'arrivée ou de déménagement" opt><select value={movedProvince} onChange={e => setMovedProvince(e.target.value)}><option value="">Non applicable</option>{PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></F>
                <F label="Résident d'une région nordique" opt><select value={northernResident} onChange={e => setNorthernResident(e.target.value)}><option value="">Non indiqué</option><option value="yes">Oui</option><option value="no">Non</option></select></F>
              </div>
              <p className="sec-title" style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                Situations applicables <span className="opt">(facultatif)</span>
              </p>
              <div className="check-grid" style={{ gap: 9 }}>
                {["Travailleur autonome","Propriétaire d'immeuble locatif","Étudiant","Nouvel arrivant","Biens ou revenus à l'étranger","Crédit pour personnes handicapées"].map(s => (
                  <label key={s} className="check-opt" style={{ display: "flex", gap: 9, padding: 12, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={situations.includes(s)} onChange={() => toggleSituation(s)} />
                    {s}
                  </label>
                ))}
              </div>
              <div style={{ marginBottom: 16 }} />
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 4 : Famille ───────────────────────────────── */}
          {step === 3 && (
            <StepCard num={4} title="Membres de la famille" desc="Ajoutez un conjoint, des enfants ou d'autres personnes à charge. Cette étape est facultative.">
              <div style={{ marginBottom: 16 }}>
                {members.length === 0 && (
                  <div style={{ textAlign: "center", padding: "22px 16px", border: "1px dashed var(--border)", borderRadius: 12, color: "var(--text-muted)", background: "var(--bg-base)", fontSize: 13 }}>
                    Aucun membre ajouté pour le moment.
                  </div>
                )}
                {members.map((m, i) => (
                  <div key={m.id} className="member-card">
                    <div className="member-head">
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Membre {i + 1}</h3>
                      <button onClick={() => removeMember(m.id)} className="remove-btn">Retirer</button>
                    </div>
                    <div className="grid2" style={{ gap: 12 }}>
                      <div className="span2">
                        <label style={{ fontSize: 13, fontWeight: 600 }}>Lien avec le titulaire</label>
                        <select value={m.relation} onChange={e => updateMember(m.id, "relation", e.target.value)} style={{ marginTop: 5 }}>
                          <option value="">Sélectionner</option>
                          <option>Conjoint(e)</option><option>Enfant</option>
                          <option>Parent</option><option>Autre personne à charge</option>
                        </select>
                      </div>
                      <div><label style={{ fontSize: 13, fontWeight: 600 }}>Prénom</label><input value={m.firstName} onChange={e => updateMember(m.id, "firstName", e.target.value)} style={{ marginTop: 5 }} /></div>
                      <div><label style={{ fontSize: 13, fontWeight: 600 }}>Nom de famille</label><input value={m.lastName} onChange={e => updateMember(m.id, "lastName", e.target.value)} style={{ marginTop: 5 }} /></div>
                      <div><label style={{ fontSize: 13, fontWeight: 600 }}>Date de naissance</label><input type="date" value={m.birthDate} onChange={e => updateMember(m.id, "birthDate", e.target.value)} style={{ marginTop: 5 }} /></div>
                      <div><label style={{ fontSize: 13, fontWeight: 600 }}>NAS <span className="opt">(facultatif)</span></label><input value={m.nas} onChange={e => updateMember(m.id, "nas", e.target.value)} placeholder="••• ••• •••" style={{ marginTop: 5 }} /></div>
                      <div><label style={{ fontSize: 13, fontWeight: 600 }}>Revenu net estimé <span className="opt">(facultatif)</span></label><input type="number" value={m.income} onChange={e => updateMember(m.id, "income", e.target.value)} placeholder="0,00 $" style={{ marginTop: 5 }} /></div>
                      <div>
                        <label style={{ fontSize: 13, fontWeight: 600 }}>Garde <span className="opt">(si enfant)</span></label>
                        <select value={m.custody} onChange={e => updateMember(m.id, "custody", e.target.value)} style={{ marginTop: 5 }}>
                          <option value="">Non applicable</option>
                          <option>Garde complète</option><option>Garde partagée</option><option>Autre arrangement</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
                <button onClick={addMember} className="add-btn">+ Ajouter un membre de la famille</button>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 5 : Consentements ─────────────────────────── */}
          {step === 4 && (
            <StepCard num={5} title="Consentements et préférences" desc="Définissez le cadre de votre futur dossier.">
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 12px" }}>Préparation du dossier</p>
              {["Je prépare mon dossier moi-même","Je prévois inviter un préparateur fiscal","Je ne sais pas encore"].map(opt => (
                <label key={opt} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8, fontSize: 13, cursor: "pointer", background: preparer === opt ? "rgba(11,107,103,0.06)" : "var(--bg-base)", borderColor: preparer === opt ? "#0b6b67" : "var(--border)" }}>
                  <input type="radio" name="preparer" checked={preparer === opt} onChange={() => setPreparer(opt)} style={{ width: 16, minHeight: 16, accentColor: "#0b6b67", marginTop: 1 }} />
                  {opt}
                </label>
              ))}
              <div style={{ marginTop: 20 }}>
                <label className="consent-box" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 13, border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={consent1} onChange={e => setConsent1(e.target.checked)} style={{ width: 16, minHeight: 16, accentColor: "#0b6b67", marginTop: 2 }} />
                  Je confirme que les renseignements fournis sont exacts à ma connaissance.
                </label>
                <label className="consent-box" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 13, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={consent2} onChange={e => setConsent2(e.target.checked)} style={{ width: 16, minHeight: 16, accentColor: "#0b6b67", marginTop: 2 }} />
                  J'accepte que ce profil serve à configurer mon espace fiscal EasyTax.
                </label>
              </div>
              <div style={{ marginBottom: 16 }} />
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 6 : Révision ──────────────────────────────── */}
          {step === 5 && (
            <StepCard num={6} title="Révision" desc="Vérifiez les renseignements essentiels avant de vous inscrire. Vous pourrez revenir en arrière.">
              <div style={{ background: "rgba(11,107,103,0.08)", color: "#084d4a", padding: 16, borderRadius: 12, marginBottom: 16, display: "flex", gap: 12, fontSize: 13 }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx={12} cy={12} r={10}/><path d="M12 8v4m0 4h.01"/>
                </svg>
                <span>Vous pourrez modifier toutes ces informations depuis votre profil EasyTax.</span>
              </div>
              <div className="review-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { title: "Titulaire", rows: [["Nom", `${firstName} ${lastName}`], ["Naissance", birthDate], ["Statut", canadaStatus], ["Langue", language === "fr" ? "Français" : "English"]] },
                  { title: "Coordonnées", rows: [["Courriel", email], ["Téléphone", phone || "—"], ["Ville", city || "—"], ["Province", PROVINCES.find(p => p.value === province)?.label ?? province]] },
                  { title: "Profil fiscal", rows: [["État civil", marital], ["Province fiscale", PROVINCES.find(p => p.value === taxProvince)?.label ?? taxProvince], ["Première année", taxYear]] },
                  { title: "Famille & préparation", rows: [["Membres ajoutés", String(members.length)], ["Préparation", preparer], ["Situations", situations.length > 0 ? situations.join(", ") : "—"]] },
                ].map(({ title, rows }) => (
                  <div key={title} style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
                    {rows.map(([label, val]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--text-muted)" }}>{label}</span>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)", textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val || "—"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <Actions onBack={back} onNext={next} nextLabel="Créer mon profil →" />
            </StepCard>
          )}

          {/* ── ÉTAPE 7 : Inscription (soumission) ──────────────── */}
          {step === 6 && <SubmitStep data={allData} onBack={back} onDone={onDone} />}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// WIZARD ENTREPRISE — 7 étapes
// ════════════════════════════════════════════════════════════════════════════════

const BIZ_STEPS = ["Entreprise", "Immatriculation", "Activités", "Exercice et taxes", "Contact", "Révision", "Inscription"];

function BusinessWizard({ onBack, onDone, prefill }: {
  onBack: () => void;
  onDone: (data: Record<string, unknown>) => void;
  prefill: { email?: string };
}) {
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");

  // Étape 1
  const [legalName,    setLegalName]   = useState("");
  const [tradeName,    setTradeName]   = useState("");
  const [legalForm,    setLegalForm]   = useState("");
  const [jurisdiction, setJurisdiction]= useState("");
  const [regJurisdiction, setRegJurisdiction] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [startDate,    setStartDate]   = useState("");
  const [language,     setLanguage]    = useState("fr");

  // Étape 2
  const [neq,      setNeq]      = useState("");
  const [federalBN,setFederalBN]= useState("");
  const [rpAccount,setRpAccount]= useState("");
  const [otherReg, setOtherReg] = useState("");
  const [xprov, setXprov] = useState<string[]>([]);

  // Étape 3
  const [mainActivity,      setMainActivity]      = useState("");
  const [scian,             setScian]             = useState("");
  const [employees,         setEmployees]         = useState("");
  const [shareholders,      setShareholders]      = useState("");
  const [estimatedRevenue,  setEstimatedRevenue]  = useState("");
  const [channels,          setChannels]          = useState<string[]>([]);

  // Étape 4
  const [fiscalStart, setFiscalStart] = useState("");
  const [fiscalEnd,   setFiscalEnd]   = useState("");
  const [accounting,  setAccounting]  = useState("");
  const [currency,    setCurrency]    = useState("CAD");
  const [gstStatus,   setGstStatus]   = useState("");
  const [gstNumber,   setGstNumber]   = useState("");
  const [qstStatus,   setQstStatus]   = useState("");
  const [qstNumber,   setQstNumber]   = useState("");
  const [taxProvinces, setTaxProvinces] = useState<string[]>([]);
  const [taxDetails, setTaxDetails] = useState<Record<string, string>>({});
  const [taxFreq,     setTaxFreq]     = useState("");
  const [taxYear,     setTaxYear]     = useState("2025");

  // Étape 5
  const [address,    setAddress]    = useState("");
  const [city,       setCity]       = useState("");
  const [province,   setProvince]   = useState("QC");
  const [postal,     setPostal]     = useState("");
  const [bizPhone,   setBizPhone]   = useState("");
  const [contactFirst, setContactFirst] = useState("");
  const [contactLast,  setContactLast]  = useState("");
  const [contactRole,  setContactRole]  = useState("");
  const [contactEmail, setContactEmail] = useState(prefill.email ?? "");
  const [consentAuth,  setConsentAuth]  = useState(false);

  const toggleChannel = (v: string) => setChannels(c => c.includes(v) ? c.filter(x => x !== v) : [...c, v]);
  const toggleXprov = (v: string) => setXprov(c => c.includes(v) ? c.filter(x => x !== v) : [...c, v]);
  const toggleTaxProvince = (v: string) => setTaxProvinces(c => c.includes(v) ? c.filter(x => x !== v) : [...c, v]);

  const validate = (): boolean => {
    setErr("");
    if (step === 0 && (!legalName || !legalForm || !jurisdiction)) { setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false; }
    if (step === 2 && !mainActivity) { setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false; }
    if (step === 3 && (!gstStatus || !taxYear)) { setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false; }
    if (step === 4 && (!contactFirst || !contactLast || !contactEmail || !consentAuth)) { setErr("Veuillez remplir les champs obligatoires et confirmer votre autorisation."); return false; }
    return true;
  };

  const next = () => { if (!validate()) return; if (step < 6) setStep(s => s + 1); };
  const back = () => { setErr(""); if (step === 0) onBack(); else setStep(s => s - 1); };

  const allData = {
    type: "BUSINESS", legalName, tradeName, legalForm, jurisdiction, startDate, language,
    neq, federalBN, rpAccount, otherReg, regJurisdiction, regNumber, xprov,
    mainActivity, scian, employees, shareholders, estimatedRevenue, channels,
    fiscalStart, fiscalEnd, accounting, currency, gstStatus, gstNumber, qstStatus, qstNumber, taxProvinces, taxDetails, taxFreq, taxYear,
    address, city, province, postal, bizPhone, contactFirst, contactLast, contactRole, contactEmail,
  };

  const F = ({ label, opt, hint, children }: { label: string; opt?: boolean; hint?: string; children: React.ReactNode }) => (
    <div>
      <label>{label} {opt && <span className="opt">(facultatif)</span>}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(1.8rem,4vw,2.8rem)", margin: "0 0 6px", color: "var(--text-primary)" }}>
            Votre espace entreprise
          </h1>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>Identité juridique, opérations et configuration fiscale</p>
        </div>
        <button onClick={onBack} style={{ border: 0, background: "transparent", color: "#0b6b67", fontWeight: 700, cursor: "pointer", font: "inherit", fontSize: 13, padding: "8px 2px" }}>
          Changer de type
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 20, alignItems: "start" }}>
        <div><StepRail steps={BIZ_STEPS} current={step} /></div>
        <div>
          {err && <div style={{ background: "rgba(229,52,42,0.08)", border: "1px solid rgba(229,52,42,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "var(--et-red)" }}>⚠️ {err}</div>}

          {/* ── ÉTAPE 1 : Identité entreprise ───────────────────── */}
          {step === 0 && (
            <StepCard num={1} title="Identité de l'entreprise" desc="Le profil légal de l'entité ou de l'activité autonome.">
              <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
                <div className="span2"><F label="Nom légal de l'entreprise *"><input value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="9876543 Canada Inc." autoFocus /></F></div>
                <div className="span2"><F label="Nom commercial" opt hint="S'il diffère de la dénomination légale"><input value={tradeName} onChange={e => setTradeName(e.target.value)} placeholder="Restaurant ABC" /></F></div>
                <F label="Forme juridique *">
                  <select value={legalForm} onChange={e => setLegalForm(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Travailleur autonome / entreprise individuelle</option>
                    <option>Société par actions</option><option>Société de personnes</option>
                    <option>Coopérative</option><option>Organisme sans but lucratif</option>
                    <option>Fiducie</option><option>Autre</option>
                  </select>
                </F>
                <F label="Territoire de constitution *">
                  <select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Fédéral (Corporations Canada)</option>{PROVINCES.map(p => <option key={p.value}>{p.label}</option>)}<option>Non constituée en société</option>
                  </select>
                </F>
                <F label="Date de constitution ou de début d'activité" opt><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></F>
                <F label="Langue de communication *">
                  <select value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="fr">Français</option><option value="en">English</option>
                  </select>
                </F>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 2 : Immatriculation ───────────────────────── */}
          {step === 1 && (
            <StepCard num={2} title="Immatriculation" desc="Les numéros qui identifient votre entreprise auprès des autorités.">
              <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
                <F label="NEQ (Québec)" opt hint="10 chiffres"><input value={neq} onChange={e => setNeq(e.target.value)} placeholder="1234567890" /></F>
                <F label="Numéro d'entreprise fédéral (NE)" opt hint="9 chiffres"><input value={federalBN} onChange={e => setFederalBN(e.target.value)} placeholder="123456789" /></F>
                <F label="Compte de retenues sur la paie (RP)" opt><input value={rpAccount} onChange={e => setRpAccount(e.target.value)} placeholder="123456789RP0001" /></F>
                <F label="Autres inscriptions ou permis" opt><input value={otherReg} onChange={e => setOtherReg(e.target.value)} placeholder="Permis d'alcool, CNESST..." /></F>
                <F label="Juridiction d'immatriculation" opt><select value={regJurisdiction} onChange={e => setRegJurisdiction(e.target.value)}><option value="">Sélectionner</option><option>Fédéral</option>{PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></F>
                <F label="Numéro d'immatriculation" opt><input value={regNumber} onChange={e => setRegNumber(e.target.value)} placeholder="Numéro provincial ou territorial" /></F>
                <div className="span2"><p className="sec-title">Exploitation dans d'autres provinces ou territoires <span className="opt">(facultatif)</span></p><div className="check-grid">{PROVINCES.map(p => <label key={p.value} className="check-opt"><input type="checkbox" checked={xprov.includes(p.value)} onChange={() => toggleXprov(p.value)} />{p.label}</label>)}</div></div>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 3 : Activités ─────────────────────────────── */}
          {step === 2 && (
            <StepCard num={3} title="Activités et organisation" desc="Décrivez ce que fait l'entreprise et comment elle est structurée.">
              <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
                <div className="span2"><F label="Activité principale *"><input value={mainActivity} onChange={e => setMainActivity(e.target.value)} placeholder="Ex: Vente au détail de vêtements" autoFocus /></F></div>
                <F label="Code SCIAN" opt hint="Si connu"><input value={scian} onChange={e => setScian(e.target.value)} placeholder="448110" /></F>
                <F label="Nombre d'employés" opt><input type="number" value={employees} onChange={e => setEmployees(e.target.value)} placeholder="0" min={0} /></F>
                <F label="Nombre d'actionnaires ou associés" opt><input type="number" value={shareholders} onChange={e => setShareholders(e.target.value)} placeholder="1" min={1} /></F>
                <F label="Revenus annuels estimés" opt>
                  <select value={estimatedRevenue} onChange={e => setEstimatedRevenue(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Moins de 30 000 $</option><option>30 000 $ à 99 999 $</option>
                    <option>100 000 $ à 499 999 $</option><option>500 000 $ à 999 999 $</option>
                    <option>1 M$ et plus</option><option>À déterminer</option>
                  </select>
                </F>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "16px 0 10px" }}>Canaux d'activité <span className="opt">(plusieurs choix)</span></p>
              <div className="check-grid" style={{ gap: 9 }}>
                {["En personne","Commerce ou services en ligne","Ventes ailleurs au Canada","Activités internationales"].map(c => (
                  <label key={c} style={{ display: "flex", gap: 9, padding: 12, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={channels.includes(c)} onChange={() => toggleChannel(c)} style={{ accentColor: "#0b6b67" }} />
                    {c}
                  </label>
                ))}
              </div>
              <div style={{ marginBottom: 16 }} />
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 4 : Exercice et taxes ─────────────────────── */}
          {step === 3 && (
            <StepCard num={4} title="Exercice et taxes" desc="Configurez les périodes comptables et les comptes de taxes applicables.">
              <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
                <F label="Début de l'exercice financier" opt><input type="date" value={fiscalStart} onChange={e => setFiscalStart(e.target.value)} autoFocus /></F>
                <F label="Fin de l'exercice financier" opt><input type="date" value={fiscalEnd} onChange={e => setFiscalEnd(e.target.value)} /></F>
                <F label="Méthode comptable" opt>
                  <select value={accounting} onChange={e => setAccounting(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Comptabilité d'exercice</option>
                    <option>Comptabilité de caisse — admissible</option>
                    <option>À déterminer avec un professionnel</option>
                  </select>
                </F>
                <F label="Devise fonctionnelle" opt>
                  <select value={currency} onChange={e => setCurrency(e.target.value)}>
                    <option value="CAD">CAD — Dollar canadien</option>
                    <option value="USD">USD — Dollar américain</option>
                    <option value="other">Autre</option>
                  </select>
                </F>
                <F label="Inscription TPS/TVH *">
                  <select value={gstStatus} onChange={e => setGstStatus(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Inscrite</option><option>Non inscrite</option>
                    <option>Inscription en cours</option><option>À déterminer</option>
                  </select>
                </F>
                <F label="Numéro TPS/TVH" opt><input value={gstNumber} onChange={e => setGstNumber(e.target.value)} placeholder="123456789RT0001" /></F>
                <div className="span2"><p className="sec-title">Provinces ou territoires d'exploitation pour les taxes de vente</p><div className="check-grid">{PROVINCES.map(p => <label key={p.value} className="check-opt"><input type="checkbox" checked={taxProvinces.includes(p.value)} onChange={() => toggleTaxProvince(p.value)} />{p.label}</label>)}</div><p className="hint">La TPS/TVH est fédérale; les règles provinciales varient selon le lieu d'exploitation.</p></div>
                {taxProvinces.length > 0 && <div className="span2"><p className="sec-title">Comptes de taxes provinciales sélectionnés <span className="opt">(facultatif)</span></p><div className="grid2">{taxProvinces.map(code => <F key={code} label={`Compte de taxe — ${code}`} opt><input value={taxDetails[code] ?? ""} onChange={e => setTaxDetails(d => ({ ...d, [code]: e.target.value }))} placeholder="Numéro ou statut" /></F>)}</div></div>}
                <F label="Inscription TVQ" opt>
                  <select value={qstStatus} onChange={e => setQstStatus(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Inscrite</option><option>Non inscrite</option>
                    <option>Inscription en cours</option><option>Non applicable</option>
                  </select>
                </F>
                <F label="Numéro TVQ" opt><input value={qstNumber} onChange={e => setQstNumber(e.target.value)} placeholder="1234567890TQ0001" /></F>
                <F label="Fréquence de déclaration de taxes" opt>
                  <select value={taxFreq} onChange={e => setTaxFreq(e.target.value)}>
                    <option value="">À déterminer</option>
                    <option>Mensuelle</option><option>Trimestrielle</option><option>Annuelle</option>
                  </select>
                </F>
                <F label="Première année fiscale dans EasyTax *">
                  <select value={taxYear} onChange={e => setTaxYear(e.target.value)}>
                    <option value="2025">2025</option><option value="2024">2024</option>
                    <option value="2023">2023</option><option value="other">Année antérieure</option>
                  </select>
                </F>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 5 : Contact principal ─────────────────────── */}
          {step === 4 && (
            <StepCard num={5} title="Adresse et contact principal" desc="Le siège de l'entreprise et la personne responsable du compte.">
              <div className="grid2" style={{ gap: 16, marginBottom: 16 }}>
                <div className="span2"><F label="Adresse d'affaires" opt><input value={address} onChange={e => setAddress(e.target.value)} placeholder="123, rue Commerciale" autoFocus /></F></div>
                <F label="Ville" opt><input value={city} onChange={e => setCity(e.target.value)} placeholder="Montréal" /></F>
                <F label="Province ou territoire" opt>
                  <select value={province} onChange={e => setProvince(e.target.value)}>
                    {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </F>
                <F label="Code postal" opt><input value={postal} onChange={e => setPostal(e.target.value)} placeholder="H1A 1A1" /></F>
                <F label="Téléphone de l'entreprise" opt><input type="tel" value={bizPhone} onChange={e => setBizPhone(e.target.value)} placeholder="(514) 555-0000" /></F>
                <F label="Prénom du contact *"><input value={contactFirst} onChange={e => setContactFirst(e.target.value)} placeholder="Jean" /></F>
                <F label="Nom du contact *"><input value={contactLast} onChange={e => setContactLast(e.target.value)} placeholder="Dupont" /></F>
                <F label="Fonction" opt><input value={contactRole} onChange={e => setContactRole(e.target.value)} placeholder="Directeur général" /></F>
                <div className="span2"><F label="Courriel professionnel *"><input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="contact@entreprise.ca" /></F></div>
              </div>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 13, border: "1px solid var(--border)", borderRadius: 10, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
                <input type="checkbox" checked={consentAuth} onChange={e => setConsentAuth(e.target.checked)} style={{ width: 16, minHeight: 16, accentColor: "#0b6b67", marginTop: 2 }} />
                Je confirme être autorisé(e) à créer et administrer cet espace au nom de l'entreprise.
              </label>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* ── ÉTAPE 6 : Révision ──────────────────────────────── */}
          {step === 5 && (
            <StepCard num={6} title="Révision" desc="Vérifiez les renseignements principaux avant de créer vos identifiants. Les numéros de programme pourront être complétés plus tard.">
              <div className="review-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { title: "Entreprise", rows: [["Nom légal", legalName], ["Forme", legalForm], ["Territoire", jurisdiction], ["Début", startDate || "—"]] },
                  { title: "Activités", rows: [["Activité", mainActivity], ["Employés", employees || "—"], ["Revenus estimés", estimatedRevenue || "—"]] },
                  { title: "Fiscalité", rows: [["Exercice", fiscalStart ? `${fiscalStart} — ${fiscalEnd}` : "—"], ["TPS/TVH", gstStatus], ["TVQ", qstStatus || "—"], ["Première année", taxYear]] },
                  { title: "Contact principal", rows: [["Nom", `${contactFirst} ${contactLast}`], ["Fonction", contactRole || "—"], ["Courriel", contactEmail], ["Ville", city || "—"]] },
                ].map(({ title, rows }) => (
                  <div key={title} style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{title}</h3>
                    {rows.map(([label, val]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--text-muted)" }}>{label}</span>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)", textAlign: "right", maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{val || "—"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <Actions onBack={back} onNext={next} nextLabel="Créer l'espace entreprise →" />
            </StepCard>
          )}

          {/* ── ÉTAPE 7 : Inscription ───────────────────────────── */}
          {step === 6 && <SubmitStep data={allData} onBack={back} onDone={onDone} />}
        </div>
      </div>
    </div>
  );
}

// ── ÉTAPE FINALE : SOUMISSION ─────────────────────────────────────────────────
function SubmitStep({ data, onBack, onDone }: {
  data: Record<string, unknown>;
  onBack: () => void;
  onDone: (d: Record<string, unknown>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await fetch("/api/auth/sync", { method: "POST" });
      const res = await fetch("/api/auth/create-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Erreur création profil");
      }
      await fetch("/api/auth/complete-onboarding", { method: "POST" });
      onDone(data);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      <div style={{ padding: 28 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", paddingBottom: 20, borderBottom: "1px solid var(--border)", marginBottom: 22 }}>
          <span style={{ color: "#0b6b67", fontWeight: 700, paddingTop: 4, fontSize: 14 }}>07</span>
          <div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 24, margin: "0 0 4px", color: "var(--text-primary)" }}>Créez vos identifiants</h2>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14 }}>
              {data.type === "INDIVIDUAL" ? "Votre profil personnel est prêt." : "Le profil de l'entreprise est prêt."}
              {" "}Choisissez comment vous accéderez à votre dossier.
            </p>
          </div>
        </div>

        {error && <div style={{ background: "rgba(229,52,42,0.08)", border: "1px solid rgba(229,52,42,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--et-red)" }}>⚠️ {error}</div>}

        <div style={{ maxWidth: 400 }}>
          <button style={{ width: "100%", border: "1px solid var(--border)", background: "var(--bg-base)", borderRadius: 9, minHeight: 48, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16, opacity: 0.6, cursor: "not-allowed", font: "inherit" }}>
            <span style={{ fontWeight: 700, color: "#4285f4", fontSize: 18 }}>G</span> Continuer avec Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} /><span>ou</span><div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          <button onClick={submit} disabled={saving} style={{
            width: "100%", border: 0, borderRadius: 9, minHeight: 48, fontWeight: 700, cursor: saving ? "wait" : "pointer",
            background: saving ? "var(--border)" : "#0b6b67", color: saving ? "var(--text-muted)" : "#fff",
            font: "inherit", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {saving ? "Création en cours..." : (data.type === "INDIVIDUAL" ? "Créer mon espace EasyTax →" : "Créer l'espace entreprise →")}
          </button>

          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", padding: 12, borderRadius: 9, marginTop: 16, color: "var(--text-muted)", fontSize: 13 }}>
            La connexion Google sera activée lors de l'intégration complète à Clerk.
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 7, color: "var(--text-muted)", fontSize: 12, marginTop: 16 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x={3} y={11} width={18} height={11} rx={2}/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Inscription sécurisée — données chiffrées
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 28px", borderTop: "1px solid var(--border)", background: "var(--bg-base)" }}>
        <button onClick={onBack} style={{ border: "1px solid var(--border)", borderRadius: 9, minHeight: 44, padding: "10px 18px", fontWeight: 700, cursor: "pointer", background: "transparent", color: "var(--text-secondary)", font: "inherit" }}>
          ← Précédent
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════════════════════════

function OnboardingContent() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = searchParams.get("type");
    if (t === "business") setAccountType("BUSINESS");
    else if (t === "individual" || t === "preparer") setAccountType("INDIVIDUAL");
  }, [searchParams]);

  const prefill = {
    firstName: user?.firstName ?? "",
    lastName:  user?.lastName  ?? "",
    email:     user?.emailAddresses?.[0]?.emailAddress ?? "",
  };

  const handleDone = (data: Record<string, unknown>) => {
    setDone(true);
    setTimeout(() => {
      router.push(data.type === "BUSINESS" ? "/business" : "/dossier");
    }, 1800);
  };

  if (!isLoaded) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 36, height: 36, border: "4px solid #fee2e2", borderTopColor: "#E5342A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (done) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg-base)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, color: "var(--text-primary)", margin: "0 0 8px" }}>Bienvenue sur EasyTax !</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Votre espace est prêt. Redirection...</p>
        <div style={{ width: 32, height: 32, border: "3px solid #dee", borderTopColor: "#0b6b67", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "20px auto 0" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  return (
    <div className="wz">
      <style>{CSS}</style>
      {/* Barre de navigation top */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,0.95)", backdropFilter: "blur(10px)",
        borderBottom: "1px solid #e8eeec",
        padding: "0 20px", height: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, color: "#E5342A" }}>Easy</span>
          <span style={{ fontFamily: "Georgia,serif", fontSize: 20, fontWeight: 700, color: "#0f1f1e" }}>Tax</span>
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: "rgba(11,107,103,0.1)", color: "#0b6b67", letterSpacing: "0.04em" }}>CANADA</span>
        </a>
        <a href="/sign-in" style={{ fontSize: 13, color: "#526865", textDecoration: "none", fontWeight: 500 }}>
          Déjà un compte ? Se connecter
        </a>
      </nav>
      <div className="wz-shell">
        <div className="topline" />
        {!accountType && <Chooser onChoose={setAccountType} />}
        {accountType === "INDIVIDUAL" && (
          <IndividualWizard onBack={() => setAccountType(null)} onDone={handleDone} prefill={prefill} />
        )}
        {accountType === "BUSINESS" && (
          <BusinessWizard onBack={() => setAccountType(null)} onDone={handleDone} prefill={{ email: prefill.email }} />
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ width: 36, height: 36, border: "4px solid #fee2e2", borderTopColor: "#E5342A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
