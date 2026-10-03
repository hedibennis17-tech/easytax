"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3 | 4;
type AccountType = "INDIVIDUAL" | "BUSINESS";

const PROVINCES = [
  { value: "QC", label: "Québec" },
  { value: "ON", label: "Ontario" },
  { value: "BC", label: "Colombie-Britannique" },
  { value: "AB", label: "Alberta" },
  { value: "SK", label: "Saskatchewan" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "Nouveau-Brunswick" },
  { value: "NS", label: "Nouvelle-Écosse" },
  { value: "PE", label: "Île-du-Prince-Édouard" },
  { value: "NL", label: "Terre-Neuve-et-Labrador" },
  { value: "NT", label: "Territoires du Nord-Ouest" },
  { value: "NU", label: "Nunavut" },
  { value: "YT", label: "Yukon" },
];

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form individuel
  const [firstName, setFirstName]       = useState("");
  const [lastName,  setLastName]        = useState("");
  const [dateOfBirth, setDateOfBirth]   = useState("");
  const [province,    setProvince]      = useState("QC");
  const [phone,       setPhone]         = useState("");

  // Form entreprise
  const [legalName,  setLegalName]    = useState("");
  const [tradeName,  setTradeName]    = useState("");
  const [bizProvince, setBizProvince] = useState("QC");

  // Pré-remplir depuis Clerk
  useEffect(() => {
    if (isLoaded && user) {
      if (user.firstName) setFirstName(user.firstName);
      if (user.lastName)  setLastName(user.lastName);
    }
  }, [isLoaded, user]);

  // ── Créer le compte complet ───────────────────────────────────────────────
  const createAccount = async () => {
    setSaving(true);
    setError("");
    try {
      // 1. Sync user Clerk → EasyTax
      const syncRes = await fetch("/api/auth/sync", { method: "POST" });
      if (!syncRes.ok) throw new Error("Erreur sync");

      // 2. Créer le profil fiscal
      const profileRes = await fetch("/api/auth/create-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          accountType === "INDIVIDUAL"
            ? { type: "INDIVIDUAL", firstName, lastName, dateOfBirth, province, phone }
            : { type: "BUSINESS", legalName, tradeName, province: bizProvince }
        ),
      });
      if (!profileRes.ok) {
        const d = await profileRes.json();
        throw new Error(d.error ?? "Erreur création profil");
      }

      // 3. Marquer onboarding complété
      await fetch("/api/auth/complete-onboarding", { method: "POST" });

      setStep(4);
      setTimeout(() => {
        router.push(accountType === "BUSINESS" ? "/business" : "/dossier");
      }, 1500);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  if (!isLoaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f7f8" }}>
        <div style={{ width: 36, height: 36, border: "4px solid #fee2e2", borderTopColor: "#E5342A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const progress = ((step - 1) / 3) * 100;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Logo */}
      <div style={{ marginBottom: 28, textAlign: "center" }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: "#E5342A" }}>Easy</span>
        <span style={{ fontSize: 28, fontWeight: 800, color: "#111" }}>Tax</span>
        <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Déclaration fiscale 2025</div>
      </div>

      <div style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 24, boxShadow: "0 4px 32px rgba(0,0,0,0.10)", padding: "28px 24px" }}>

        {/* Barre de progression */}
        {step < 4 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#999", marginBottom: 8 }}>
              <span>Étape {step} sur 3</span>
              <span style={{ color: "#E5342A", fontWeight: 700 }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 5, background: "#f0f0f0", borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#E5342A", borderRadius: 100, transition: "width 400ms ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              {["Type de compte", "Votre profil", "Confirmation"].map((label, i) => {
                const active = i + 1 === step;
                const done   = i + 1 < step;
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: done ? "#16A34A" : active ? "#E5342A" : "#f0f0f0",
                      color: (done || active) ? "#fff" : "#999",
                      transition: "all 300ms",
                    }}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span style={{ fontSize: 10, color: active ? "#E5342A" : done ? "#16A34A" : "#bbb", fontWeight: active ? 700 : 400, textAlign: "center" }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ÉTAPE 1 : Type de compte ──────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: "#111" }}>
              Bienvenue{user?.firstName ? `, ${user.firstName}` : ""} ! 👋
            </h1>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 24px", lineHeight: 1.5 }}>
              Quel type de compte souhaitez-vous créer ?
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  type: "INDIVIDUAL" as AccountType,
                  icon: "👤",
                  title: "Particulier",
                  desc: "Déclaration personnelle T1 · TP-1",
                  badge: "Emploi · Autonome · Placements · Famille",
                  color: "#2563EB",
                },
                {
                  type: "BUSINESS" as AccountType,
                  icon: "🏢",
                  title: "Entreprise",
                  desc: "Déclaration corporative T2 · CO-17",
                  badge: "Revenus · Dépenses · Paie · TPS/TVQ",
                  color: "#7C3AED",
                },
              ].map(({ type, icon, title, desc, badge, color }) => {
                const selected = accountType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setAccountType(type)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 14, padding: "18px 16px",
                      borderRadius: 16, border: `2px solid ${selected ? color : "#e5e5e5"}`,
                      background: selected ? `${color}08` : "#fafafa",
                      cursor: "pointer", textAlign: "left", transition: "all 150ms",
                    }}
                  >
                    <span style={{ fontSize: 32, flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: selected ? color : "#111", marginBottom: 3 }}>
                        {title}
                      </div>
                      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{desc}</div>
                      <div style={{ fontSize: 10, color: selected ? color : "#999", fontWeight: 600 }}>
                        {badge}
                      </div>
                    </div>
                    {selected && (
                      <span style={{ marginLeft: "auto", flexShrink: 0, width: 22, height: 22, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!accountType}
              style={{
                width: "100%", marginTop: 20, padding: "14px 0", borderRadius: 14,
                fontSize: 15, fontWeight: 700, border: "none", cursor: accountType ? "pointer" : "not-allowed",
                background: accountType ? "#E5342A" : "#f0f0f0",
                color: accountType ? "#fff" : "#bbb",
                transition: "all 150ms",
              }}
            >
              Continuer →
            </button>
          </div>
        )}

        {/* ── ÉTAPE 2 : Profil ─────────────────────────────────────── */}
        {step === 2 && accountType === "INDIVIDUAL" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px", color: "#111" }}>
              👤 Votre profil personnel
            </h2>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 22px" }}>
              Ces informations apparaîtront sur votre déclaration T1 / TP-1
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Prénom *</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Marie" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nom de famille *</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Tremblay" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Date de naissance *</label>
                <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Province de résidence au 31 déc. 2025 *</label>
                <select value={province} onChange={e => setProvince(e.target.value)} style={inputStyle}>
                  {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Téléphone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(514) 555-0000" style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setStep(1)} style={backBtnStyle}>← Retour</button>
              <button
                onClick={() => setStep(3)}
                disabled={!firstName || !lastName || !dateOfBirth}
                style={{
                  ...nextBtnStyle,
                  background: (firstName && lastName && dateOfBirth) ? "#E5342A" : "#f0f0f0",
                  color: (firstName && lastName && dateOfBirth) ? "#fff" : "#bbb",
                  cursor: (firstName && lastName && dateOfBirth) ? "pointer" : "not-allowed",
                }}
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {step === 2 && accountType === "BUSINESS" && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px", color: "#111" }}>
              🏢 Votre entreprise
            </h2>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 22px" }}>
              Informations de base pour votre dossier T2 / CO-17
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Dénomination sociale légale *</label>
                <input value={legalName} onChange={e => setLegalName(e.target.value)} placeholder="9876543 Canada Inc." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nom commercial (optionnel)</label>
                <input value={tradeName} onChange={e => setTradeName(e.target.value)} placeholder="Restaurant ABC" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Province principale *</label>
                <select value={bizProvince} onChange={e => setBizProvince(e.target.value)} style={inputStyle}>
                  {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button onClick={() => setStep(1)} style={backBtnStyle}>← Retour</button>
              <button
                onClick={() => setStep(3)}
                disabled={!legalName}
                style={{
                  ...nextBtnStyle,
                  background: legalName ? "#E5342A" : "#f0f0f0",
                  color: legalName ? "#fff" : "#bbb",
                  cursor: legalName ? "pointer" : "not-allowed",
                }}
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 3 : Confirmation ────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px", color: "#111" }}>
              ✅ Confirmez vos informations
            </h2>
            <p style={{ fontSize: 12, color: "#888", margin: "0 0 20px" }}>
              Vérifiez avant de créer votre compte EasyTax
            </p>

            <div style={{ background: "#f8f8f8", borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
              {accountType === "INDIVIDUAL" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Row label="Type" value="👤 Particulier" />
                  <Row label="Nom complet" value={`${firstName} ${lastName}`} />
                  <Row label="Date de naissance" value={dateOfBirth} />
                  <Row label="Province" value={PROVINCES.find(p => p.value === province)?.label ?? province} />
                  {phone && <Row label="Téléphone" value={phone} />}
                  <Row label="Email" value={user?.emailAddresses?.[0]?.emailAddress ?? "—"} />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Row label="Type" value="🏢 Entreprise" />
                  <Row label="Dénomination" value={legalName} />
                  {tradeName && <Row label="Nom commercial" value={tradeName} />}
                  <Row label="Province" value={PROVINCES.find(p => p.value === bizProvince)?.label ?? bizProvince} />
                  <Row label="Email" value={user?.emailAddresses?.[0]?.emailAddress ?? "—"} />
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#dc2626" }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={backBtnStyle} disabled={saving}>← Retour</button>
              <button
                onClick={createAccount}
                disabled={saving}
                style={{ ...nextBtnStyle, background: "#E5342A", color: "#fff", cursor: saving ? "wait" : "pointer", opacity: saving ? 0.8 : 1 }}
              >
                {saving ? "Création en cours..." : "Créer mon compte EasyTax →"}
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 4 : Succès ─────────────────────────────────────── */}
        {step === 4 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111", margin: "0 0 8px" }}>
              Bienvenue sur EasyTax !
            </h2>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 8px" }}>
              Votre compte a été créé avec succès.
            </p>
            <p style={{ fontSize: 12, color: "#999" }}>
              Redirection vers votre espace...
            </p>
            <div style={{ width: 36, height: 36, border: "4px solid #fee2e2", borderTopColor: "#E5342A", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "20px auto 0" }} />
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={{ fontSize: 11, color: "#bbb", marginTop: 20, textAlign: "center" }}>
        EasyTax Canada · Données chiffrées · Résultats préliminaires
      </p>
    </div>
  );
}

// ── Helpers UI ────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#888" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{value}</span>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: 10,
  border: "1.5px solid #e5e5e5", background: "#fafafa",
  fontSize: 14, color: "#111", outline: "none", boxSizing: "border-box",
};

const backBtnStyle: React.CSSProperties = {
  padding: "13px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600,
  background: "#f5f5f5", color: "#666", border: "none", cursor: "pointer",
};

const nextBtnStyle: React.CSSProperties = {
  flex: 1, padding: "13px 0", borderRadius: 12, fontSize: 14,
  fontWeight: 700, border: "none", transition: "all 150ms",
};
