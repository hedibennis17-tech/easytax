"use client";

import { useUser } from "@clerk/nextjs";
import { useApp } from "@/components/ThemeProvider";
import { AppNav } from "@/components/AppNav";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ─── Données pancanadiennes ──────────────────────────────────
const PROVINCES_FR = [
  "Alberta","Colombie-Britannique","Île-du-Prince-Édouard","Manitoba",
  "Nouveau-Brunswick","Nouvelle-Écosse","Ontario","Québec","Saskatchewan",
  "Terre-Neuve-et-Labrador","Territoires du Nord-Ouest","Nunavut","Yukon",
];

const PROVINCES_CODE: Record<string,string> = {
  "Alberta":"AB","Colombie-Britannique":"BC","Île-du-Prince-Édouard":"PE",
  "Manitoba":"MB","Nouveau-Brunswick":"NB","Nouvelle-Écosse":"NS",
  "Ontario":"ON","Québec":"QC","Saskatchewan":"SK",
  "Terre-Neuve-et-Labrador":"NL","Territoires du Nord-Ouest":"NT",
  "Nunavut":"NU","Yukon":"YT",
};

// Numéros d'immatriculation par juridiction
const REG_INFO: Record<string, { label: string; hint: string; ph: string }> = {
  "Fédéral (Corporations Canada)": { label:"Numéro de société fédérale", hint:"Attribué par Corporations Canada. Immatriculation extraprovinciale requise dans chaque province/territoire d'exploitation.", ph:"Ex. 123456-7" },
  "Alberta": { label:"Numéro d'accès corporatif (Alberta)", hint:"Registre des sociétés de l'Alberta, via un agent de registres autorisé.", ph:"" },
  "Colombie-Britannique": { label:"Numéro de constitution (C.-B.)", hint:"BC Registry Services.", ph:"Ex. BC1234567" },
  "Île-du-Prince-Édouard": { label:"Numéro d'entreprise (Î.-P.-É.)", hint:"Registre des sociétés de l'Île-du-Prince-Édouard.", ph:"" },
  "Manitoba": { label:"Numéro d'entreprise (Manitoba)", hint:"Office des compagnies du Manitoba.", ph:"" },
  "Nouveau-Brunswick": { label:"Numéro de corporation (N.-B.)", hint:"Service Nouveau-Brunswick — registre corporatif.", ph:"" },
  "Nouvelle-Écosse": { label:"Numéro de registre (N.-É.)", hint:"Registry of Joint Stock Companies.", ph:"" },
  "Ontario": { label:"Numéro de société de l'Ontario", hint:"ServiceOntario. Les sociétés extraprovinciales doivent détenir un permis extraprovincial ontarien.", ph:"Ex. 1234567" },
  "Québec": { label:"NEQ — Numéro d'entreprise du Québec", hint:"10 chiffres. Registraire des entreprises du Québec.", ph:"10 chiffres" },
  "Saskatchewan": { label:"Numéro d'entité (Saskatchewan)", hint:"Registre des sociétés de la Saskatchewan (ISC).", ph:"" },
  "Terre-Neuve-et-Labrador": { label:"Numéro de compagnie (T.-N.-L.)", hint:"Registre des compagnies de Terre-Neuve-et-Labrador.", ph:"" },
  "Territoires du Nord-Ouest": { label:"Numéro d'enregistrement (TNO)", hint:"Registres des sociétés des Territoires du Nord-Ouest.", ph:"" },
  "Nunavut": { label:"Numéro d'enregistrement (Nunavut)", hint:"Registres juridiques du Nunavut.", ph:"" },
  "Yukon": { label:"Numéro d'enregistrement (Yukon)", hint:"Affaires corporatives du Yukon.", ph:"" },
};

// Taxes de vente par province d'exploitation
type TaxProvInfo = { taxes: { name: string; numLabel: string }[]; note: string | null; filing: string };
const TAX_INFO: Record<string, TaxProvInfo> = {
  "Québec":                    { taxes:[{ name:"TVQ — 9,975 %",           numLabel:"Numéro TVQ" }], note:null, filing:"T2 fédérale + CO-17 (Revenu Québec)" },
  "Ontario":                   { taxes:[], note:"TVH de 13 % — aucun compte provincial distinct.", filing:"T2 fédérale (ARC perçoit l'impôt ontarien)" },
  "Colombie-Britannique":      { taxes:[{ name:"TVP/PST de la C.-B. — 7 %",         numLabel:"Numéro TVP (C.-B.)" }], note:null, filing:"T2 fédérale" },
  "Alberta":                   { taxes:[], note:"TPS de 5 % seulement — aucune taxe provinciale.", filing:"T2 fédérale + AT1 (Alberta Tax and Revenue Administration)" },
  "Saskatchewan":              { taxes:[{ name:"TVP/PST de la Saskatchewan — 6 %",   numLabel:"Numéro TVP (Sask.)" }], note:null, filing:"T2 fédérale" },
  "Manitoba":                  { taxes:[{ name:"TVD/RST du Manitoba — 7 %",           numLabel:"Numéro TVD (Man.)" }], note:null, filing:"T2 fédérale" },
  "Nouveau-Brunswick":         { taxes:[], note:"TVH de 15 % — aucun compte provincial distinct.", filing:"T2 fédérale" },
  "Nouvelle-Écosse":           { taxes:[], note:"TVH de 15 % — aucun compte provincial distinct.", filing:"T2 fédérale" },
  "Île-du-Prince-Édouard":     { taxes:[], note:"TVH de 15 % — aucun compte provincial distinct.", filing:"T2 fédérale" },
  "Terre-Neuve-et-Labrador":   { taxes:[], note:"TVH de 15 % — aucun compte provincial distinct.", filing:"T2 fédérale" },
  "Territoires du Nord-Ouest": { taxes:[], note:"TPS de 5 % seulement.", filing:"T2 fédérale" },
  "Nunavut":                   { taxes:[], note:"TPS de 5 % seulement.", filing:"T2 fédérale" },
  "Yukon":                     { taxes:[], note:"TPS de 5 % seulement.", filing:"T2 fédérale" },
};

// ─── CSS ─────────────────────────────────────────────────────
const CSS = `
  .wz { font-family:"Avenir Next",Avenir,"Segoe UI",sans-serif; background:var(--bg-base); min-height:100vh; color:var(--text-primary); }
  .wz-shell { width:min(1100px,100%); margin:0 auto; padding:28px 20px 64px; }
  .topline { height:4px; background:linear-gradient(90deg,#E5342A 0 20%,#0b6b67 20% 100%); border-radius:99px; margin-bottom:22px; }
  .wz label { display:block; font-weight:600; margin-bottom:7px; font-size:14px; color:var(--text-primary); }
  .wz .opt { color:var(--text-muted); font-size:12px; font-weight:400; }
  .wz .hint { font-size:12px; color:var(--text-muted); margin:5px 0 0; line-height:1.4; }
  .wz input,.wz select,.wz textarea { width:100%; border:1px solid var(--border); border-radius:9px; background:var(--bg-base); color:var(--text-primary); padding:11px 13px; min-height:46px; font:inherit; outline:none; box-sizing:border-box; transition:border-color 150ms; }
  .wz input:focus,.wz select:focus,.wz textarea:focus { border-color:#0b6b67; box-shadow:0 0 0 3px rgba(11,107,103,.12); }
  .wz .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  .wz .span2 { grid-column:span 2; }
  .wz .check-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
  .wz .check-opt { display:flex; gap:9px; align-items:flex-start; padding:12px; border:1px solid var(--border); border-radius:10px; background:var(--bg-base); font-size:13px; cursor:pointer; transition:border-color 150ms; }
  .wz .check-opt:hover { border-color:#0b6b67; }
  .wz .check-opt input { width:16px; min-height:16px; accent-color:#0b6b67; flex-shrink:0; margin-top:1px; }
  .wz .radio-opt { display:flex; gap:10px; align-items:flex-start; padding:13px; border:1px solid var(--border); border-radius:10px; background:var(--bg-base); font-size:13px; cursor:pointer; margin-bottom:8px; transition:border-color 150ms; }
  .wz .radio-opt input { width:16px; min-height:16px; accent-color:#0b6b67; flex-shrink:0; margin-top:2px; }
  .wz .add-btn { margin-top:12px; border:1.5px dashed #0b6b67; color:#0b6b67; background:transparent; padding:11px 16px; border-radius:9px; font-weight:700; cursor:pointer; font:inherit; font-size:13px; width:100%; }
  .wz .member-card { border:1px solid var(--border); border-radius:13px; padding:18px; background:var(--bg-card); margin-bottom:12px; }
  .wz .section-title { font-size:14px; font-weight:700; color:var(--text-primary); margin:24px 0 12px; padding-top:20px; border-top:1px solid var(--border); }
  .wz .info-box { background:rgba(11,107,103,0.08); border:1px solid rgba(11,107,103,0.2); border-radius:12px; padding:14px 16px; font-size:13px; color:var(--text-primary); }
  .wz .info-box ul { margin:8px 0 0; padding-left:18px; }
  .wz .info-box li { margin:4px 0; font-size:12px; color:var(--text-secondary); }
  @media (max-width:720px) {
    .wz .grid2,.wz .check-grid { grid-template-columns:1fr; }
    .wz .span2 { grid-column:auto; }
    .wz-shell { padding:16px 14px 40px; }
    .wz-layout { grid-template-columns:1fr !important; }
    .wz-rail { display:none; }
    .wz-mobile-bar { display:block !important; }
  }
`;

// ─── Composants partagés ─────────────────────────────────────
function StepRail({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:16, padding:12, position:"sticky", top:16, minWidth:220 }}>
      {steps.map((label, i) => {
        const done = i < current, active = i === current;
        return (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"32px 1fr", gap:10, alignItems:"center", padding:"9px 10px", borderRadius:10, marginBottom:4, background:active?"rgba(11,107,103,0.1)":"transparent", color:active?"#084d4a":done?"#0b6b67":"var(--text-muted)", fontWeight:active?700:400 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", display:"grid", placeItems:"center", fontSize:12, fontWeight:700, background:(active||done)?"#0b6b67":"var(--bg-base)", color:(active||done)?"#fff":"var(--text-muted)", border:`1px solid ${(active||done)?"#0b6b67":"var(--border)"}` }}>
              {done ? "✓" : i+1}
            </div>
            <span style={{ fontSize:13 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Actions({ onBack, onNext, nextLabel="Continuer →", saving=false, disabled=false }: { onBack?:()=>void; onNext:()=>void; nextLabel?:string; saving?:boolean; disabled?:boolean }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, padding:"18px 28px", borderTop:"1px solid var(--border)", background:"var(--bg-base)" }}>
      {onBack
        ? <button onClick={onBack} style={{ border:"1px solid var(--border)", borderRadius:9, minHeight:44, padding:"10px 18px", fontWeight:700, cursor:"pointer", background:"transparent", color:"var(--text-secondary)", font:"inherit" }}>← Précédent</button>
        : <div />
      }
      <button onClick={onNext} disabled={saving||disabled} style={{ border:0, borderRadius:9, minHeight:44, padding:"11px 24px", fontWeight:700, cursor:(saving||disabled)?"not-allowed":"pointer", background:(saving||disabled)?"var(--border)":"#0b6b67", color:(saving||disabled)?"var(--text-muted)":"#fff", font:"inherit", fontSize:14, opacity:disabled?0.6:1 }}>
        {saving ? "Enregistrement..." : nextLabel}
      </button>
    </div>
  );
}

function StepCard({ num, title, desc, children }: { num:number; title:string; desc:string; children:React.ReactNode }) {
  return (
    <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:18, boxShadow:"0 4px 20px rgba(0,0,0,0.06)", overflow:"hidden" }}>
      <div style={{ padding:"28px 28px 0" }}>
        <div style={{ display:"flex", gap:14, alignItems:"flex-start", paddingBottom:20, borderBottom:"1px solid var(--border)", marginBottom:22 }}>
          <span style={{ color:"#0b6b67", fontWeight:700, paddingTop:4, fontSize:14, flexShrink:0 }}>0{num}</span>
          <div>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:26, margin:"0 0 4px", color:"var(--text-primary)" }}>{title}</h2>
            <p style={{ margin:0, color:"var(--text-secondary)", fontSize:14 }}>{desc}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function F({ label, opt, hint, children }: { label:string; opt?:boolean; hint?:string; children:React.ReactNode }) {
  return (
    <div>
      <label>{label} {opt && <span className="opt">(facultatif)</span>}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function ProvinceSelect({ value, onChange, name="province" }: { value:string; onChange:(v:string)=>void; name?:string }) {
  return (
    <select name={name} value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Sélectionner</option>
      {PROVINCES_FR.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}

// ─── CHOOSER ────────────────────────────────────────────────
function Chooser({ onChoose, prefill, lang = "fr" }: { onChoose:(t:"INDIVIDUAL"|"BUSINESS")=>void; prefill:{firstName?:string}; lang?:string }) {
  return (
    <div>
      <div style={{ maxWidth:680, padding:"36px 0 24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, color:"#0b6b67", fontWeight:700, marginBottom:18, fontSize:14 }}>
          <span style={{ width:16, height:16, borderRadius:"3px 3px 6px 3px", background:"#E5342A", transform:"rotate(-5deg)", display:"inline-block" }} />
          EasyTax CANADA
        </div>
        <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(2rem,5vw,3.5rem)", margin:"0 0 12px", lineHeight:1.1, color:"var(--text-primary)" }}>
          Quel espace souhaitez-vous créer{prefill.firstName ? `, ${prefill.firstName}` : ""} ?
        </h1>
        <p style={{ color:"var(--text-secondary)", fontSize:16, margin:"0 0 8px" }}>
          D&apos;un océan à l&apos;autre, votre dossier est configuré selon les règles de votre province ou territoire — immatriculation, taxes de vente et déclarations comprises.
        </p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:32 }}>
        {[
          { type:"INDIVIDUAL" as const, icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={30} height={30}><circle cx={12} cy={8} r={4}/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>, title:"Compte personnel", desc:"Pour vous-même et les membres de votre famille : profil fiscal, coordonnées et situation familiale." },
          { type:"BUSINESS" as const, icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} width={30} height={30}><rect x={2} y={7} width={20} height={14} rx={2}/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>, title:"Compte entreprise", desc:"Pour une société ou un travailleur autonome : immatriculation, fiscalité, taxes et personnes-ressources." },
        ].map(({ type, icon, title, desc }) => (
          <button key={type} onClick={() => onChoose(type)} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:18, padding:28, textAlign:"left", cursor:"pointer", minHeight:240, display:"flex", flexDirection:"column", transition:"all 200ms", boxShadow:"0 4px 20px rgba(0,0,0,0.06)" }}
            onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="#0b6b67";(e.currentTarget as HTMLButtonElement).style.transform="translateY(-3px)";}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor="var(--border)";(e.currentTarget as HTMLButtonElement).style.transform="";}}
          >
            <div style={{ width:54, height:54, display:"grid", placeItems:"center", borderRadius:16, background:"rgba(11,107,103,0.1)", color:"#0b6b67" }}>{icon}</div>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:24, margin:"20px 0 8px", color:"var(--text-primary)" }}>{title}</h2>
            <p style={{ color:"var(--text-secondary)", margin:"0 0 24px", fontSize:14, lineHeight:1.5 }}>{desc}</p>
            <div style={{ marginTop:"auto", color:"#0b6b67", fontWeight:700, display:"flex", gap:8, alignItems:"center", fontSize:14 }}>Créer mon espace →</div>
          </button>
        ))}
      </div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"12px 24px", color:"var(--text-muted)", fontSize:13 }}>
        {["Parcours guidé","Renseignements séparés par contexte","Révision avant inscription","13 provinces et territoires couverts"].map(p => (
          <div key={p} style={{ display:"flex", alignItems:"center", gap:7 }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0b6b67" strokeWidth={2.5}><polyline points="20 6 9 17 4 12"/></svg>
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// WIZARD INDIVIDUEL — 6 étapes + auth
// ════════════════════════════════════════════════════════════
// IND_STEPS défini à l'intérieur de IndividualWizard via IND_STEPS_FR/EN

interface Member { id:number; relation:string; firstName:string; lastName:string; birthDate:string; nas:string; income:string; custody:string }

function IndividualWizard({ onBack, onDone, prefill, lang = "fr" }: { onBack:()=>void; onDone:(d:Record<string,unknown>)=>void; prefill:{firstName?:string;lastName?:string;email?:string}; lang?:string }) {
  const IND_STEPS_FR = ["Identité","Coordonnées","Profil fiscal","Famille","Consentements","Révision"];
  const IND_STEPS_EN = ["Identity","Contacts","Tax profile","Family","Consents","Review"];
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");

  // Étape 1
  const [firstName, setFirstName]       = useState(prefill.firstName ?? "");
  const [lastName,  setLastName]        = useState(prefill.lastName ?? "");
  const [otherNames, setOtherNames]     = useState("");
  const [usageName, setUsageName]       = useState("");
  const [birthDate, setBirthDate]       = useState("");
  const [nas,       setNas]             = useState("");
  const [canStatus, setCanStatus]       = useState("");
  const [gender,    setGender]          = useState("");

  // Étape 2
  const [email,    setEmail]    = useState(prefill.email ?? "");
  const [phone,    setPhone]    = useState("");
  const [address,  setAddress]  = useState("");
  const [city,     setCity]     = useState("");
  const [province, setProvince] = useState("");
  const [postal,   setPostal]   = useState("");
  const [country,  setCountry]  = useState("Canada");
  const [language, setLanguage] = useState("fr");
  const [contactPref, setContactPref] = useState("email");

  // Étape 3
  const [marital,      setMarital]    = useState("");
  const [maritalDate,  setMaritalDate]= useState("");
  const [taxProvince,  setTaxProvince]= useState("");
  const [provChange,   setProvChange] = useState("non");
  const [prevProvince, setPrevProvince]= useState("");
  const [nordZone,     setNordZone]   = useState("non");
  const [taxYear,      setTaxYear]    = useState("2025");
  const [arrivalDate,  setArrivalDate]= useState("");
  const [departDate,   setDepartDate] = useState("");
  const [situations,   setSituations] = useState<string[]>([]);

  // Étape 4
  const [members, setMembers] = useState<Member[]>([]);

  // Étape 5
  const [preparer,  setPreparer]  = useState("");
  const [consent1,  setConsent1]  = useState(false);
  const [consent2,  setConsent2]  = useState(false);

  const toggle = (v:string) => setSituations(s => s.includes(v) ? s.filter(x=>x!==v) : [...s,v]);
  const addMember = () => setMembers(m => [...m, { id:Date.now(), relation:"", firstName:"", lastName:"", birthDate:"", nas:"", income:"", custody:"" }]);
  const removeMember = (id:number) => setMembers(m => m.filter(x=>x.id!==id));
  const updateMember = (id:number, field:string, val:string) => setMembers(m => m.map(x => x.id===id ? {...x,[field]:val} : x));

  const validate = () => {
    setErr("");
    if (step===0 && (!firstName||!lastName||!birthDate||!canStatus)) { setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false; }
    if (step===1 && (!email||!address||!city||!province||!postal)) { setErr("Veuillez remplir l’adresse complète avant de continuer."); return false; }
    if (step===2 && (!marital||!taxProvince||!taxYear)) { setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false; }
    if (step===4 && (!consent1||!consent2||!preparer)) { setErr("Veuillez confirmer les deux déclarations et votre choix de préparation."); return false; }
    return true;
  };

  const next = () => { if (!validate()) return; if (step<5) setStep(s=>s+1); };
  const back = () => { setErr(""); if (step===0) onBack(); else setStep(s=>s-1); };

  const allData = { type:"INDIVIDUAL", firstName, lastName, otherNames, usageName, birthDate, nas, canStatus, gender, email, phone, address, city, province, postal, country, language, contactPref, marital, maritalDate, taxProvince, provChange, prevProvince, nordZone, taxYear, arrivalDate, departDate, situations, members, preparer };

  const provCode = PROVINCES_CODE[taxProvince] ?? PROVINCES_CODE[province] ?? "QC";

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
        <div>
          <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(1.8rem,4vw,2.8rem)", margin:"0 0 6px", color:"var(--text-primary)" }}>Votre espace personnel</h1>
          <p style={{ color:"var(--text-secondary)", margin:0, fontSize:14 }}>Profil fiscal du titulaire et de sa famille</p>
        </div>
        <button onClick={onBack} style={{ border:0, background:"transparent", color:"#0b6b67", fontWeight:700, cursor:"pointer", font:"inherit", fontSize:13, padding:"8px 2px", whiteSpace:"nowrap" }}>Changer de type</button>
      </div>

      <div className="wz-layout" style={{ display:"grid", gridTemplateColumns:"220px minmax(0,1fr)", gap:20, alignItems:"start" }}>
        <div className="wz-rail"><StepRail steps={lang === "en" ? IND_STEPS_EN : IND_STEPS_FR} current={step} /></div>
        <div>
          {err && <div style={{ background:"rgba(229,52,42,0.08)", border:"1px solid rgba(229,52,42,0.3)", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#E5342A" }}>⚠️ {err}</div>}

          {/* 01 Identité */}
          {step===0 && (
            <StepCard num={1} title={lang === "en" ? "Account holder identity" : "Identité du titulaire"} desc={lang === "en" ? "Information as it appears on your official documents." : "Les renseignements tels qu'ils figurent sur vos documents officiels."}>
              <div className="grid2" style={{ gap:16, marginBottom:16 }}>
                <F label={lang === "en" ? "Legal first name *" : "Prénom légal *"}><input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Marie" autoFocus /></F>
                <F label={lang === "en" ? "Legal last name *" : "Nom de famille légal *"}><input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Tremblay" /></F>
                <F label="Autres prénoms" opt><input value={otherNames} onChange={e=>setOtherNames(e.target.value)} placeholder="Anne" /></F>
                <F label="Nom d'usage" opt><input value={usageName} onChange={e=>setUsageName(e.target.value)} placeholder="Si différent" /></F>
                <F label={lang === "en" ? "Date of birth *" : "Date de naissance *"}><input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} /></F>
                <F label="Numéro d'assurance sociale" opt hint="9 chiffres. Sera chiffré lors de l'intégration sécurisée."><input value={nas} onChange={e=>setNas(e.target.value)} placeholder="••• ••• •••" maxLength={11} /></F>
                <F label={lang === "en" ? "Status in Canada *" : "Statut au Canada *"}>
                  <select value={canStatus} onChange={e=>setCanStatus(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Citoyen canadien</option>
                    <option>Résident permanent</option>
                    <option>Résident temporaire</option>
                    <option>Personne protégée</option>
                    <option>Autre statut</option>
                  </select>
                </F>
                <F label="Genre" opt>
                  <select value={gender} onChange={e=>setGender(e.target.value)}>
                    <option value="">Préférer ne pas répondre</option>
                    <option>Femme</option><option>Homme</option>
                    <option>Non binaire</option><option>Autre</option>
                  </select>
                </F>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* 02 Coordonnées */}
          {step===1 && (
            <StepCard num={2} title={lang === "en" ? "Contact information" : "Coordonnées"} desc="Votre adresse principale et les moyens de vous joindre.">
              <div className="grid2" style={{ gap:16, marginBottom:16 }}>
                <F label={lang === "en" ? "Email address *" : "Adresse courriel *"}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@exemple.ca" autoFocus /></F>
                <F label="Téléphone principal" opt><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(514) 555-0000" /></F>
                <div className="span2"><F label="Adresse"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="123, rue Principale" /></F></div>
                <F label="Ville"><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Montréal" /></F>
                <F label={lang === "en" ? "Province or territory *" : "Province ou territoire *"}>
                  <ProvinceSelect value={province} onChange={value=>{ setProvince(value); if (!taxProvince) setTaxProvince(value); }} name="addr_province" />
                </F>
                <F label="Code postal"><input value={postal} onChange={e=>setPostal(e.target.value)} placeholder="H1A 1A1" /></F>
                <F label="Pays de résidence" opt>
                  <input value={country} onChange={e=>setCountry(e.target.value)} placeholder="Canada" />
                </F>
                <F label={lang === "en" ? "Language of communication *" : "Langue de communication *"}>
                  <select value={language} onChange={e=>setLanguage(e.target.value)}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </F>
                <div className="span2">
                  <label>Préférence de contact</label>
                  <div style={{ display:"flex", gap:10 }}>
                    {["Courriel","Téléphone","Les deux"].map(o => (
                      <label key={o} style={{ display:"flex", gap:8, alignItems:"center", padding:"10px 14px", border:`1px solid ${contactPref===o?"#0b6b67":"var(--border)"}`, borderRadius:9, cursor:"pointer", fontSize:13, background:contactPref===o?"rgba(11,107,103,0.06)":"var(--bg-base)" }}>
                        <input type="radio" name="contactPref" value={o} checked={contactPref===o} onChange={()=>setContactPref(o)} style={{ accentColor:"#0b6b67" }} />
                        {o}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* 03 Profil fiscal */}
          {step===2 && (
            <StepCard num={3} title={lang === "en" ? "Tax profile" : "Profil fiscal"} desc="Quelques repères pour configurer votre dossier correctement.">
              <div className="grid2" style={{ gap:16, marginBottom:16 }}>
                <F label={lang === "en" ? "Marital status *" : "État civil *"}>
                  <select value={marital} onChange={e=>setMarital(e.target.value)} autoFocus>
                    <option value="">Sélectionner</option>
                    <option>Célibataire</option><option>Marié(e)</option>
                    <option>Conjoint(e) de fait</option><option>Séparé(e)</option>
                    <option>Divorcé(e)</option><option>Veuf ou veuve</option>
                  </select>
                </F>
                <F label="Date du changement d'état civil" opt hint="S'il y a lieu">
                  <input type="date" value={maritalDate} onChange={e=>setMaritalDate(e.target.value)} />
                </F>
                <div className="span2">
                  <F label={lang === "en" ? "Province of fiscal residence on December 31 *" : "Province de résidence fiscale au 31 décembre *"}>
                    <ProvinceSelect value={taxProvince} onChange={setTaxProvince} name="tax_province" />
                  </F>
                </div>
                <F label="Changement de province/territoire en cours d'année">
                  <select value={provChange} onChange={e=>setProvChange(e.target.value)}>
                    <option value="non">Non</option>
                    <option value="oui">Oui</option>
                  </select>
                </F>
                {provChange==="oui" && (
                  <F label="Province/territoire précédent(e)">
                    <ProvinceSelect value={prevProvince} onChange={setPrevProvince} name="prev_province" />
                  </F>
                )}
                <F label="Résidence dans une zone nordique désignée">
                  <select value={nordZone} onChange={e=>setNordZone(e.target.value)}>
                    <option value="non">Non</option>
                    <option value="yt_nt_nu">Oui — Yukon, Territoires du Nord-Ouest ou Nunavut</option>
                    <option value="nord_prov">Oui — région nordique d&apos;une province</option>
                    <option value="unknown">Je ne sais pas</option>
                  </select>
                </F>
                {nordZone!=="non" && nordZone!=="" && (
                  <div className="span2 info-box" style={{ background:"rgba(11,107,103,0.08)", border:"1px solid rgba(11,107,103,0.2)", borderRadius:12, padding:"14px 16px", fontSize:13 }}>
                    Peut donner droit à la déduction pour habitants de régions éloignées (formulaire T2222, Zone A : 11 $/jour).
                  </div>
                )}
                <F label="Première année fiscale à préparer *">
                  <select value={taxYear} onChange={e=>setTaxYear(e.target.value)}>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="other">Année antérieure</option>
                  </select>
                </F>
                <F label="Date d'arrivée au Canada" opt hint="S'il y a lieu">
                  <input type="date" value={arrivalDate} onChange={e=>setArrivalDate(e.target.value)} />
                </F>
                <F label="Date de départ du Canada" opt hint="S'il y a lieu">
                  <input type="date" value={departDate} onChange={e=>setDepartDate(e.target.value)} />
                </F>
              </div>
              <p className="section-title">Situations applicables <span className="opt">(facultatif)</span></p>
              <div className="check-grid" style={{ gap:9, marginBottom:16 }}>
                {["Travailleur autonome","Propriétaire d'immeuble locatif","Étudiant","Nouvel arrivant","Biens ou revenus à l'étranger","Crédit pour personnes handicapées"].map(s => (
                  <label key={s} className="check-opt" style={{ cursor:"pointer" }}>
                    <input type="checkbox" checked={situations.includes(s)} onChange={()=>toggle(s)} />
                    {s}
                  </label>
                ))}
              </div>

              {/* Info dynamique selon la province fiscale */}
              {taxProvince && (
                <div className="info-box" style={{ marginBottom:16 }}>
                  <strong style={{ color:"#084d4a" }}>
                    {PROVINCES_CODE[taxProvince]==="QC" ? "⚜️ Québec" : `${taxProvince}`} — configuration fiscale 2025
                  </strong>
                  <ul>
                    {PROVINCES_CODE[taxProvince]==="QC" && <>
                      <li>Déclaration provinciale TP-1 distincte (Revenu Québec)</li>
                      <li>Cotisations RRQ (6,40 %) et RQAP (0,494 %) au lieu de RPC/AE</li>
                      <li>Abattement fédéral de 16,5 % applicable</li>
                    </>}
                    {PROVINCES_CODE[taxProvince]==="ON" && <>
                      <li>Surtaxe ontarienne (seule province en 2025) : 20 % sur impôt &gt; 5 710 $</li>
                      <li>Prime santé : 0 $ à 900 $ selon le revenu</li>
                      <li>Prestation Trillium — formulaire ON-BEN</li>
                    </>}
                    {PROVINCES_CODE[taxProvince]==="AB" && <>
                      <li>Montant personnel de base le plus élevé : 22 323 $</li>
                      <li>6 paliers d&apos;imposition (nouveau 8 % sur les premiers 60 000 $)</li>
                      <li>Aucune taxe de vente provinciale</li>
                    </>}
                    {["NT","NU","YT"].includes(PROVINCES_CODE[taxProvince]??"") && <>
                      <li>Déduction T2222 pour résidents du Nord applicable (11 $/jour)</li>
                      <li>Taux d&apos;imposition parmi les plus avantageux au Canada</li>
                    </>}
                    {!["QC","ON","AB","NT","NU","YT"].includes(PROVINCES_CODE[taxProvince]??"") && taxProvince && <>
                      <li>Déclaration T1 fédérale — l&apos;ARC perçoit l&apos;impôt provincial</li>
                      <li>BPA {taxProvince} 2025 configuré dans le moteur fiscal</li>
                    </>}
                  </ul>
                </div>
              )}
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* 04 Famille */}
          {step===3 && (
            <StepCard num={4} title={lang === "en" ? "Family members" : "Membres de la famille"} desc="Ajoutez un conjoint, des enfants ou d'autres personnes à charge. Cette étape est facultative.">
              <div style={{ marginBottom:16 }}>
                {members.length===0 && (
                  <div style={{ textAlign:"center", padding:"22px 16px", border:"1px dashed var(--border)", borderRadius:12, color:"var(--text-muted)", background:"var(--bg-base)", fontSize:13 }}>
                    Aucun membre ajouté pour le moment.
                  </div>
                )}
                {members.map((m, i) => (
                  <div key={m.id} className="member-card">
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                      <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:"var(--text-primary)" }}>Membre {i+1}</h3>
                      <button onClick={()=>removeMember(m.id)} style={{ border:0, background:"transparent", color:"#E5342A", cursor:"pointer", font:"inherit", fontWeight:700, fontSize:13 }}>Retirer</button>
                    </div>
                    <div className="grid2" style={{ gap:12 }}>
                      <div className="span2">
                        <label style={{ fontSize:13, fontWeight:600 }}>Lien avec le titulaire</label>
                        <select value={m.relation} onChange={e=>updateMember(m.id,"relation",e.target.value)} style={{ marginTop:5 }}>
                          <option value="">Sélectionner</option>
                          <option>Conjoint(e)</option><option>Enfant</option>
                          <option>Parent</option><option>Autre personne à charge</option>
                        </select>
                      </div>
                      <div><label style={{ fontSize:13, fontWeight:600 }}>Prénom</label><input value={m.firstName} onChange={e=>updateMember(m.id,"firstName",e.target.value)} style={{ marginTop:5 }} /></div>
                      <div><label style={{ fontSize:13, fontWeight:600 }}>Nom de famille</label><input value={m.lastName} onChange={e=>updateMember(m.id,"lastName",e.target.value)} style={{ marginTop:5 }} /></div>
                      <div><label style={{ fontSize:13, fontWeight:600 }}>Date de naissance</label><input type="date" value={m.birthDate} onChange={e=>updateMember(m.id,"birthDate",e.target.value)} style={{ marginTop:5 }} /></div>
                      <div><label style={{ fontSize:13, fontWeight:600 }}>NAS <span className="opt">(facultatif)</span></label><input value={m.nas} onChange={e=>updateMember(m.id,"nas",e.target.value)} placeholder="••• ••• •••" style={{ marginTop:5 }} /></div>
                      <div><label style={{ fontSize:13, fontWeight:600 }}>Revenu net estimé <span className="opt">(facultatif)</span></label><input type="number" value={m.income} onChange={e=>updateMember(m.id,"income",e.target.value)} placeholder="0 $" style={{ marginTop:5 }} /></div>
                      <div>
                        <label style={{ fontSize:13, fontWeight:600 }}>Garde <span className="opt">(si enfant)</span></label>
                        <select value={m.custody} onChange={e=>updateMember(m.id,"custody",e.target.value)} style={{ marginTop:5 }}>
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

          {/* 05 Consentements */}
          {step===4 && (
            <StepCard num={5} title={lang === "en" ? "Consents and preferences" : "Consentements et préférences"} desc="Définissez le cadre de votre futur dossier.">
              <p style={{ fontSize:14, fontWeight:700, color:"var(--text-primary)", margin:"0 0 12px" }}>Préparation du dossier</p>
              {["Je prépare mon dossier moi-même","Je prévois inviter un préparateur fiscal","Je ne sais pas encore"].map(opt => (
                <label key={opt} className="radio-opt" style={{ borderColor:preparer===opt?"#0b6b67":"var(--border)", background:preparer===opt?"rgba(11,107,103,0.06)":"var(--bg-base)" }}>
                  <input type="radio" name="preparer" checked={preparer===opt} onChange={()=>setPreparer(opt)} />
                  {opt}
                </label>
              ))}
              <div style={{ marginTop:20 }}>
                <label style={{ display:"flex", gap:10, alignItems:"flex-start", padding:13, border:"1px solid var(--border)", borderRadius:10, marginBottom:8, fontSize:13, cursor:"pointer" }}>
                  <input type="checkbox" checked={consent1} onChange={e=>setConsent1(e.target.checked)} style={{ width:16, minHeight:16, accentColor:"#0b6b67", marginTop:2 }} />
                  Je confirme que les renseignements fournis sont exacts à ma connaissance.
                </label>
                <label style={{ display:"flex", gap:10, alignItems:"flex-start", padding:13, border:"1px solid var(--border)", borderRadius:10, fontSize:13, cursor:"pointer" }}>
                  <input type="checkbox" checked={consent2} onChange={e=>setConsent2(e.target.checked)} style={{ width:16, minHeight:16, accentColor:"#0b6b67", marginTop:2 }} />
                  J&apos;accepte que ce profil serve à configurer mon espace fiscal EasyTax.
                </label>
              </div>
              <div style={{ marginBottom:16 }} />
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* 06 Révision */}
          {step===5 && (
            <StepCard num={6} title={lang === "en" ? "Review" : "Révision"} desc="Vérifiez les renseignements essentiels avant de vous inscrire. Vous pourrez revenir en arrière.">
              <div style={{ background:"rgba(11,107,103,0.08)", border:"1px solid rgba(11,107,103,0.2)", borderRadius:12, padding:16, marginBottom:16, display:"flex", gap:12, fontSize:13 }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink:0, color:"#0b6b67" }}><circle cx={12} cy={12} r={10}/><path d="M12 8v4m0 4h.01"/></svg>
                <span>Vous pourrez modifier toutes ces informations depuis votre profil EasyTax.</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                {[
                  { title:"Titulaire", rows:[["Nom",`${firstName} ${lastName}`],["Naissance",birthDate],["Statut",canStatus],["Langue",language==="fr"?"Français":"English"]] },
                  { title:lang === "en" ? "Contact information" : "Coordonnées", rows:[["Courriel",email],["Téléphone",phone||"—"],["Ville",city||"—"],["Province",province||"—"]] },
                  { title:lang === "en" ? "Tax profile" : "Profil fiscal", rows:[["État civil",marital],["Province fiscale",taxProvince||"—"],["Année",taxYear],["Zone nord",nordZone!=="non"?"Oui":"Non"]] },
                  { title:"Famille & préparation", rows:[["Membres",String(members.length)],["Préparation",preparer||"—"],["Situations",situations.length>0?situations.join(", "):"—"]] },
                ].map(({ title, rows }) => (
                  <div key={title} style={{ background:"var(--bg-base)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
                    <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700, color:"var(--text-primary)", fontFamily:"Georgia,serif" }}>{title}</h3>
                    {rows.map(([label, val]) => (
                      <div key={label} style={{ display:"flex", justifyContent:"space-between", gap:12, fontSize:13, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                        <span style={{ color:"var(--text-muted)" }}>{label}</span>
                        <span style={{ fontWeight:600, color:"var(--text-primary)", textAlign:"right", maxWidth:"60%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{val||"—"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <Actions onBack={back} onNext={()=>onDone({ ...allData, provinceCode: provCode })} nextLabel={lang === "en" ? "Create my profile →" : "Créer mon profil →"} />
            </StepCard>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// WIZARD ENTREPRISE — 6 étapes + auth
// ════════════════════════════════════════════════════════════
// BIZ_STEPS défini à l'intérieur de BusinessWizard via BIZ_STEPS_FR/EN

function BusinessWizard({ onBack, onDone, prefill, lang = "fr" }: { onBack:()=>void; onDone:(d:Record<string,unknown>)=>void; prefill:{email?:string}; lang?:string }) {
  const BIZ_STEPS_FR = ["Identité","Immatriculation","Activités","Exercice et taxes","Contact","Révision"];
  const BIZ_STEPS_EN = ["Identity","Registration","Activities","Fiscal year & taxes","Contact","Review"];
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");

  // Étape 1
  const [legalName,   setLegalName]    = useState("");
  const [tradeName,   setTradeName]    = useState("");
  const [legalForm,   setLegalForm]    = useState("");
  const [jurisdiction,setJurisdiction] = useState("");
  const [startDate,   setStartDate]    = useState("");
  const [language,    setLanguage]     = useState("fr");

  // Étape 2
  const [federalBN,     setFederalBN]     = useState("");
  const [regJuris,      setRegJuris]      = useState("");
  const [regNumber,     setRegNumber]     = useState("");
  const [rpAccount,     setRpAccount]     = useState("");
  const [otherProvinces,setOtherProvinces]= useState<string[]>([]);
  const [otherReg,      setOtherReg]      = useState("");

  // Étape 3
  const [mainActivity,setMainActivity] = useState("");
  const [scian,       setScian]        = useState("");
  const [employees,   setEmployees]    = useState("");
  const [shareholders,setShareholders] = useState("");
  const [revenue,     setRevenue]      = useState("");
  const [channels,    setChannels]     = useState<string[]>([]);

  // Étape 4
  const [fiscalStart, setFiscalStart]  = useState("");
  const [fiscalEnd,   setFiscalEnd]    = useState("");
  const [accounting,  setAccounting]   = useState("");
  const [currency,    setCurrency]     = useState("CAD");
  const [gstStatus,   setGstStatus]    = useState("");
  const [gstNumber,   setGstNumber]    = useState("");
  const [taxFreq,     setTaxFreq]      = useState("");
  const [taxYear,     setTaxYear]      = useState("2025");
  const [provTaxNumbers, setProvTaxNumbers] = useState<Record<string,string>>({});

  // Étape 5
  const [address,      setAddress]      = useState("");
  const [city,         setCity]         = useState("");
  const [bizProvince,  setBizProvince]  = useState("");
  const [postal,       setPostal]       = useState("");
  const [bizPhone,     setBizPhone]     = useState("");
  const [contactFirst, setContactFirst] = useState("");
  const [contactLast,  setContactLast]  = useState("");
  const [contactRole,  setContactRole]  = useState("");
  const [contactEmail, setContactEmail] = useState(prefill.email ?? "");
  const [consentAuth,  setConsentAuth]  = useState(false);

  const toggleChannel = (v:string) => setChannels(c => c.includes(v) ? c.filter(x=>x!==v) : [...c,v]);
  const toggleProvince = (v:string) => setOtherProvinces(p => p.includes(v) ? p.filter(x=>x!==v) : [...p,v]);

  const validate = () => {
    setErr("");
    if (step===0 && (!legalName||!legalForm||!jurisdiction)) { setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false; }
    if (step===2 && !mainActivity) { setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false; }
    if (step===3 && (!gstStatus||!taxYear)) { setErr("Veuillez remplir les champs obligatoires avant de continuer."); return false; }
    if (step===4 && (!address||!city||!bizProvince||!postal||!contactFirst||!contactLast||!contactEmail||!consentAuth)) { setErr("Veuillez remplir l’adresse complète et confirmer votre autorisation."); return false; }
    return true;
  };

  const next = () => { if (!validate()) return; if (step<5) setStep(s=>s+1); };
  const back = () => { setErr(""); if (step===0) onBack(); else setStep(s=>s-1); };

  // Numéro d'immatriculation dynamique selon la juridiction choisie
  const regInfo = REG_INFO[regJuris] ?? null;

  // Taxes de vente dynamiques selon les provinces d'exploitation
  const allExploitProvinces = Array.from(new Set([bizProvince, ...otherProvinces].filter(Boolean)));

  const allData = { type:"BUSINESS", legalName, tradeName, legalForm, jurisdiction, startDate, language, federalBN, regJuris, regNumber, rpAccount, otherProvinces, otherReg, mainActivity, scian, employees, shareholders, revenue, channels, fiscalStart, fiscalEnd, accounting, currency, gstStatus, gstNumber, taxFreq, taxYear, address, city, bizProvince, postal, bizPhone, contactFirst, contactLast, contactRole, contactEmail };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
        <div>
          <h1 style={{ fontFamily:"Georgia,serif", fontSize:"clamp(1.8rem,4vw,2.8rem)", margin:"0 0 6px", color:"var(--text-primary)" }}>Votre espace entreprise</h1>
          <p style={{ color:"var(--text-secondary)", margin:0, fontSize:14 }}>Identité juridique, opérations et configuration fiscale</p>
        </div>
        <button onClick={onBack} style={{ border:0, background:"transparent", color:"#0b6b67", fontWeight:700, cursor:"pointer", font:"inherit", fontSize:13, padding:"8px 2px" }}>Changer de type</button>
      </div>

      <div className="wz-layout" style={{ display:"grid", gridTemplateColumns:"220px minmax(0,1fr)", gap:20, alignItems:"start" }}>
        <div className="wz-rail"><StepRail steps={lang === "en" ? BIZ_STEPS_EN : BIZ_STEPS_FR} current={step} /></div>
        <div>
          {err && <div style={{ background:"rgba(229,52,42,0.08)", border:"1px solid rgba(229,52,42,0.3)", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, color:"#E5342A" }}>⚠️ {err}</div>}

          {/* 01 Identité entreprise */}
          {step===0 && (
            <StepCard num={1} title="Identité de l'entreprise" desc="Le profil légal de l'entité ou de l'activité autonome.">
              <div className="grid2" style={{ gap:16, marginBottom:16 }}>
                <div className="span2"><F label="Nom légal de l'entreprise *"><input value={legalName} onChange={e=>setLegalName(e.target.value)} placeholder="9876543 Canada Inc." autoFocus /></F></div>
                <div className="span2"><F label="Nom commercial" opt hint="S'il diffère de la dénomination légale"><input value={tradeName} onChange={e=>setTradeName(e.target.value)} placeholder="Restaurant ABC" /></F></div>
                <F label="Forme juridique *">
                  <select value={legalForm} onChange={e=>setLegalForm(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Travailleur autonome / entreprise individuelle</option>
                    <option>Société par actions</option><option>Société de personnes</option>
                    <option>Coopérative</option><option>Organisme sans but lucratif</option>
                    <option>Fiducie</option><option>Autre</option>
                  </select>
                </F>
                <F label="Juridiction de constitution *">
                  <select value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Fédéral (Corporations Canada)</option>
                    {PROVINCES_FR.map(p=><option key={p}>{p}</option>)}
                    <option>Non constituée en société</option>
                  </select>
                </F>
                <F label="Date de constitution ou de début d'activité" opt><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} /></F>
                <F label={lang === "en" ? "Language of communication *" : "Langue de communication *"}>
                  <select value={language} onChange={e=>setLanguage(e.target.value)}>
                    <option value="fr">Français</option><option value="en">English</option>
                  </select>
                </F>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* 02 Immatriculation */}
          {step===1 && (
            <StepCard num={2} title="Immatriculation" desc="Les numéros qui identifient votre entreprise auprès des autorités.">
              <div className="grid2" style={{ gap:16, marginBottom:16 }}>
                <div className="span2">
                  <F label="Numéro d'entreprise fédéral (NE)" opt hint="9 chiffres. Attribué par l'ARC. Distinct du numéro de constitution.">
                    <input value={federalBN} onChange={e=>setFederalBN(e.target.value)} placeholder="123456789" />
                  </F>
                </div>
                <F label="Juridiction d'immatriculation" opt>
                  <select value={regJuris} onChange={e=>{ setRegJuris(e.target.value); setRegNumber(""); }}>
                    <option value="">Sélectionner</option>
                    <option>Fédéral (Corporations Canada)</option>
                    {PROVINCES_FR.map(p=><option key={p}>{p}</option>)}
                  </select>
                </F>
                {regInfo ? (
                  <F label={regInfo.label} opt hint={regInfo.hint}>
                    <input value={regNumber} onChange={e=>setRegNumber(e.target.value)} placeholder={regInfo.ph} />
                  </F>
                ) : (
                  <div style={{ display:"flex", alignItems:"center", color:"var(--text-muted)", fontSize:13, paddingTop:28 }}>
                    Sélectionnez d&apos;abord la juridiction d&apos;immatriculation.
                  </div>
                )}
                <F label="Compte de retenues sur la paie (RP)" opt hint="ARC partout au Canada. Au Québec, les cotisations RRQ/RQAP et l'impôt provincial passent par Revenu Québec.">
                  <input value={rpAccount} onChange={e=>setRpAccount(e.target.value)} placeholder="123456789RP0001" />
                </F>
                <div />
                <div className="span2">
                  <label style={{ display:"block", fontWeight:600, marginBottom:10, fontSize:14 }}>
                    Exploitation dans d&apos;autres provinces/territoires <span className="opt">(plusieurs choix)</span>
                  </label>
                  <p className="hint" style={{ marginBottom:10 }}>Une immatriculation ou licence extraprovinciale est exigée dans chaque province/territoire où l&apos;entreprise exerce des activités.</p>
                  <div className="check-grid" style={{ gap:8 }}>
                    {PROVINCES_FR.map(p => (
                      <label key={p} className="check-opt">
                        <input type="checkbox" checked={otherProvinces.includes(p)} onChange={()=>toggleProvince(p)} />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="span2">
                  <F label="Autres inscriptions ou permis" opt><input value={otherReg} onChange={e=>setOtherReg(e.target.value)} placeholder="Permis d'alcool, CNESST..." /></F>
                </div>
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* 03 Activités */}
          {step===2 && (
            <StepCard num={3} title="Activités et organisation" desc="Décrivez ce que fait l'entreprise et comment elle est structurée.">
              <div className="grid2" style={{ gap:16, marginBottom:16 }}>
                <div className="span2"><F label="Activité principale *"><input value={mainActivity} onChange={e=>setMainActivity(e.target.value)} placeholder="Ex: Vente au détail de vêtements" autoFocus /></F></div>
                <F label="Code SCIAN" opt><input value={scian} onChange={e=>setScian(e.target.value)} placeholder="448110" /></F>
                <F label="Nombre d'employés" opt><input type="number" value={employees} onChange={e=>setEmployees(e.target.value)} placeholder="0" min={0} /></F>
                <F label="Nombre d'actionnaires ou associés" opt><input type="number" value={shareholders} onChange={e=>setShareholders(e.target.value)} placeholder="1" min={1} /></F>
                <F label="Revenus annuels estimés" opt>
                  <select value={revenue} onChange={e=>setRevenue(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Moins de 30 000 $</option><option>30 000 $ à 99 999 $</option>
                    <option>100 000 $ à 499 999 $</option><option>500 000 $ à 999 999 $</option>
                    <option>1 M$ et plus</option><option>À déterminer</option>
                  </select>
                </F>
              </div>
              <p className="section-title">Canaux d&apos;activité <span className="opt">(plusieurs choix)</span></p>
              <div className="check-grid" style={{ gap:9, marginBottom:16 }}>
                {["En personne","Commerce ou services en ligne","Ventes ailleurs au Canada","Activités internationales"].map(c => (
                  <label key={c} className="check-opt"><input type="checkbox" checked={channels.includes(c)} onChange={()=>toggleChannel(c)} />{c}</label>
                ))}
              </div>
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* 04 Exercice et taxes */}
          {step===3 && (
            <StepCard num={4} title="Exercice et taxes" desc="Configurez les périodes comptables et les comptes de taxes applicables.">
              <div className="grid2" style={{ gap:16, marginBottom:16 }}>
                <F label="Début de l'exercice financier" opt><input type="date" value={fiscalStart} onChange={e=>setFiscalStart(e.target.value)} autoFocus /></F>
                <F label="Fin de l'exercice financier" opt><input type="date" value={fiscalEnd} onChange={e=>setFiscalEnd(e.target.value)} /></F>
                <F label="Méthode comptable" opt>
                  <select value={accounting} onChange={e=>setAccounting(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Comptabilité d'exercice</option>
                    <option>Comptabilité de caisse — admissible</option>
                    <option>À déterminer avec un professionnel</option>
                  </select>
                </F>
                <F label="Devise fonctionnelle" opt>
                  <select value={currency} onChange={e=>setCurrency(e.target.value)}>
                    <option value="CAD">CAD — Dollar canadien</option>
                    <option value="USD">USD — Dollar américain</option>
                    <option value="other">Autre</option>
                  </select>
                </F>
                <F label="Inscription TPS/TVH *">
                  <select value={gstStatus} onChange={e=>setGstStatus(e.target.value)}>
                    <option value="">Sélectionner</option>
                    <option>Inscrite</option><option>Non inscrite</option>
                    <option>Inscription en cours</option><option>À déterminer</option>
                  </select>
                </F>
                <F label="Numéro TPS/TVH" opt><input value={gstNumber} onChange={e=>setGstNumber(e.target.value)} placeholder="123456789RT0001" /></F>
                <F label="Fréquence de déclaration de taxes" opt>
                  <select value={taxFreq} onChange={e=>setTaxFreq(e.target.value)}>
                    <option value="">À déterminer</option>
                    <option>Mensuelle</option><option>Trimestrielle</option><option>Annuelle</option>
                  </select>
                </F>
                <F label="Première année fiscale dans EasyTax *">
                  <select value={taxYear} onChange={e=>setTaxYear(e.target.value)}>
                    <option value="2025">2025</option><option value="2024">2024</option>
                    <option value="2023">2023</option><option value="other">Année antérieure</option>
                  </select>
                </F>
              </div>

              {/* Taxes de vente dynamiques par province d'exploitation */}
              {allExploitProvinces.length > 0 && (
                <div>
                  <p className="section-title">Provinces/territoires d&apos;exploitation — taxes de vente</p>
                  <div className="info-box" style={{ marginBottom:14 }}>
                    La TPS/TVH s&apos;applique partout au Canada. Selon la province :
                    <ul>
                      <li>TVQ au Québec (9,975 %)</li>
                      <li>TVP en C.-B. (7 %) et en Saskatchewan (6 %)</li>
                      <li>TVD au Manitoba (7 %)</li>
                      <li>TVH harmonisée : Ontario 13 %, Maritimes et T.-N.-L. 15 %</li>
                      <li>Aucune taxe provinciale : Alberta, T.N.-O., Nunavut, Yukon</li>
                    </ul>
                  </div>
                  {allExploitProvinces.map(prov => {
                    const info = TAX_INFO[prov];
                    if (!info) return null;
                    return (
                      <div key={prov} style={{ border:"1px solid var(--border)", borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"var(--text-primary)", marginBottom:8 }}>{prov}</div>
                        {info.note && <p style={{ fontSize:12, color:"var(--text-muted)", margin:"0 0 8px" }}>{info.note}</p>}
                        {info.taxes.map(t => (
                          <div key={t.name} className="grid2" style={{ gap:12, marginBottom:8 }}>
                            <div style={{ fontSize:13, color:"var(--text-secondary)", alignSelf:"center" }}>{t.name}</div>
                            <F label={t.numLabel} opt>
                              <input
                                value={provTaxNumbers[`${prov}_${t.numLabel}`] ?? ""}
                                onChange={e=>setProvTaxNumbers(n=>({...n,[`${prov}_${t.numLabel}`]:e.target.value}))}
                                placeholder="Numéro d'inscription"
                              />
                            </F>
                          </div>
                        ))}
                        <p style={{ fontSize:11, color:"var(--text-muted)", margin:0 }}>Dépôt : {info.filing}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* 05 Contact */}
          {step===4 && (
            <StepCard num={5} title="Adresse et contact principal" desc="Le siège de l'entreprise et la personne responsable du compte.">
              <div className="grid2" style={{ gap:16, marginBottom:16 }}>
                <div className="span2"><F label="Adresse d'affaires"><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="123, rue Commerciale" autoFocus /></F></div>
                <F label="Ville"><input value={city} onChange={e=>setCity(e.target.value)} placeholder="Montréal" /></F>
                <F label="Province ou territoire">
                  <ProvinceSelect value={bizProvince} onChange={setBizProvince} name="biz_province" />
                </F>
                <F label="Code postal"><input value={postal} onChange={e=>setPostal(e.target.value)} placeholder="H1A 1A1" /></F>
                <F label="Téléphone de l'entreprise" opt><input type="tel" value={bizPhone} onChange={e=>setBizPhone(e.target.value)} placeholder="(514) 555-0000" /></F>
                <F label="Prénom du contact *"><input value={contactFirst} onChange={e=>setContactFirst(e.target.value)} placeholder="Jean" /></F>
                <F label="Nom du contact *"><input value={contactLast} onChange={e=>setContactLast(e.target.value)} placeholder="Dupont" /></F>
                <F label="Fonction" opt><input value={contactRole} onChange={e=>setContactRole(e.target.value)} placeholder="Directeur général" /></F>
                <div className="span2"><F label="Courriel professionnel *"><input type="email" value={contactEmail} onChange={e=>setContactEmail(e.target.value)} placeholder="contact@entreprise.ca" /></F></div>
              </div>
              <label style={{ display:"flex", gap:10, alignItems:"flex-start", padding:13, border:"1px solid var(--border)", borderRadius:10, fontSize:13, cursor:"pointer", marginBottom:8 }}>
                <input type="checkbox" checked={consentAuth} onChange={e=>setConsentAuth(e.target.checked)} style={{ width:16, minHeight:16, accentColor:"#0b6b67", marginTop:2 }} />
                Je confirme être autorisé(e) à créer et administrer cet espace au nom de l&apos;entreprise.
              </label>
              <div style={{ marginBottom:16 }} />
              <Actions onBack={back} onNext={next} />
            </StepCard>
          )}

          {/* 06 Révision */}
          {step===5 && (
            <StepCard num={6} title={lang === "en" ? "Review" : "Révision"} desc="Vérifiez les renseignements principaux avant de créer vos identifiants. Les numéros de programme pourront être complétés plus tard.">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                {[
                  { title:"Entreprise", rows:[["Nom légal",legalName],["Forme",legalForm],["Juridiction",jurisdiction],["Début",startDate||"—"]] },
                  { title:"Activités", rows:[["Activité",mainActivity],["Employés",employees||"—"],["Revenus estimés",revenue||"—"]] },
                  { title:"Fiscalité", rows:[["Exercice",fiscalStart?`${fiscalStart} — ${fiscalEnd}`:"—"],["TPS/TVH",gstStatus],["Première année",taxYear],["Provinces",allExploitProvinces.join(", ")||"—"]] },
                  { title:"Contact principal", rows:[["Nom",`${contactFirst} ${contactLast}`],["Fonction",contactRole||"—"],["Courriel",contactEmail],["Ville",city||"—"]] },
                ].map(({ title, rows }) => (
                  <div key={title} style={{ background:"var(--bg-base)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
                    <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700, color:"var(--text-primary)", fontFamily:"Georgia,serif" }}>{title}</h3>
                    {rows.map(([label, val]) => (
                      <div key={label} style={{ display:"flex", justifyContent:"space-between", gap:12, fontSize:13, padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                        <span style={{ color:"var(--text-muted)" }}>{label}</span>
                        <span style={{ fontWeight:600, color:"var(--text-primary)", textAlign:"right", maxWidth:"60%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{val||"—"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <Actions onBack={back} onNext={()=>onDone(allData)} nextLabel={lang === "en" ? "Create business space →" : "Créer l'espace entreprise →"} />
            </StepCard>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ÉTAPE AUTH (commune) ─────────────────────────────────────
function AuthStep({ data, onBack, onDone, saving, error, lang = "fr" }: { data:Record<string,unknown>; onBack:()=>void; onDone:()=>void; saving:boolean; error:string; lang?:string }) {
  return (
    <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:18, boxShadow:"0 4px 20px rgba(0,0,0,0.06)", overflow:"hidden" }}>
      <div style={{ padding:28 }}>
        <div style={{ display:"flex", gap:14, alignItems:"flex-start", paddingBottom:20, borderBottom:"1px solid var(--border)", marginBottom:22 }}>
          <span style={{ color:"#0b6b67", fontWeight:700, paddingTop:4, fontSize:14 }}>07</span>
          <div>
            <h2 style={{ fontFamily:"Georgia,serif", fontSize:24, margin:"0 0 4px", color:"var(--text-primary)" }}>Créez vos identifiants</h2>
            <p style={{ margin:0, color:"var(--text-secondary)", fontSize:14 }}>
              {data.type==="INDIVIDUAL" ? "Votre profil personnel est prêt." : "Le profil de l'entreprise est prêt."}
              {" "}Choisissez comment vous accéderez à votre dossier.
            </p>
          </div>
        </div>
        {error && <div style={{ background:"rgba(229,52,42,0.08)", border:"1px solid rgba(229,52,42,0.3)", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#E5342A" }}>⚠️ {error}</div>}
        <div style={{ maxWidth:400 }}>
          <button disabled style={{ width:"100%", border:"1px solid var(--border)", background:"var(--bg-base)", borderRadius:9, minHeight:48, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:12, marginBottom:16, opacity:0.5, cursor:"not-allowed", font:"inherit", fontSize:14, color:"var(--text-primary)" }}>
            <span style={{ fontWeight:700, color:"#4285f4", fontSize:18 }}>G</span> Continuer avec Google
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:12, color:"var(--text-muted)", fontSize:13, marginBottom:16 }}>
            <div style={{ flex:1, height:1, background:"var(--border)" }} /><span>ou</span><div style={{ flex:1, height:1, background:"var(--border)" }} />
          </div>
          <button onClick={onDone} disabled={saving} style={{ width:"100%", border:0, borderRadius:9, minHeight:48, fontWeight:700, cursor:saving?"wait":"pointer", background:saving?"var(--border)":"#0b6b67", color:saving?"var(--text-muted)":"#fff", font:"inherit", fontSize:14 }}>
            {saving ? "Création en cours..." : (data.type==="INDIVIDUAL" ? "Créer mon espace EasyTax →" : "Créer l'espace entreprise →")}
          </button>
          <div style={{ background:"var(--bg-base)", border:"1px solid var(--border)", padding:12, borderRadius:9, marginTop:16, color:"var(--text-muted)", fontSize:12, textAlign:"center" }}>
            La connexion Google sera activée lors de l&apos;intégration complète à Clerk.
          </div>
          <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:7, color:"var(--text-muted)", fontSize:11, marginTop:14 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x={3} y={11} width={18} height={11} rx={2}/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Inscription sécurisée — données chiffrées
          </div>
        </div>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", padding:"16px 28px", borderTop:"1px solid var(--border)", background:"var(--bg-base)" }}>
        <button onClick={onBack} style={{ border:"1px solid var(--border)", borderRadius:9, minHeight:44, padding:"10px 18px", fontWeight:700, cursor:"pointer", background:"transparent", color:"var(--text-secondary)", font:"inherit" }}>← Précédent</button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ════════════════════════════════════════════════════════════
function OnboardingContent() {
  const { user, isLoaded } = useUser();
  const { lang } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [accountType, setAccountType]   = useState<"INDIVIDUAL"|"BUSINESS"|null>(null);
  const [showAuth,    setShowAuth]       = useState(false);
  const [formData,    setFormData]       = useState<Record<string,unknown>>({});
  const [saving,      setSaving]         = useState(false);
  const [error,       setError]          = useState("");
  const [done,        setDone]           = useState(false);

  useEffect(() => {
    const t = searchParams.get("type");
    if (t==="business") setAccountType("BUSINESS");
    else if (t==="individual"||t==="preparer") setAccountType("INDIVIDUAL");
  }, [searchParams]);

  const prefill = {
    firstName: user?.firstName ?? "",
    lastName:  user?.lastName  ?? "",
    email:     user?.emailAddresses?.[0]?.emailAddress ?? "",
  };

  const handleWizardDone = (data: Record<string,unknown>) => {
    setFormData(data);
    setShowAuth(true);
  };

  const createAccount = async () => {
    setSaving(true); setError("");
    try {
      await fetch("/api/auth/sync", { method:"POST" });
      const res = await fetch("/api/auth/create-profile", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(formData),
      });
      if (!res.ok) { const d = await res.json() as {error?:string}; throw new Error(d.error ?? "Erreur création profil"); }
      await fetch("/api/auth/complete-onboarding", { method:"POST" });
      setDone(true);
      setTimeout(() => router.push(formData.type==="BUSINESS" ? "/business" : "/dossier"), 1500);
    } catch(e) { setError((e as Error).message); setSaving(false); }
  };

  if (!isLoaded) return (
    <div style={{ minHeight:"100vh", display:"grid", placeItems:"center" }}>
      <div style={{ width:36, height:36, border:"4px solid #fee2e2", borderTopColor:"#E5342A", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (done) return (
    <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"var(--bg-base)" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:60, marginBottom:16 }}>🎉</div>
        <h1 style={{ fontFamily:"Georgia,serif", fontSize:28, color:"var(--text-primary)", margin:"0 0 8px" }}>Bienvenue sur EasyTax !</h1>
        <p style={{ color:"var(--text-secondary)", fontSize:15 }}>Votre espace est prêt. Redirection...</p>
        <div style={{ width:32, height:32, border:"3px solid #dee", borderTopColor:"#0b6b67", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"20px auto 0" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  return (
    <div className="wz">
      <style>{CSS}</style>
      {/* Navigation complète avec liens desktop et menu hamburger mobile */}
      <AppNav />

      <div className="wz-shell">
        <div className="topline" />

        {/* Chooser */}
        {!accountType && !showAuth && (
          <Chooser onChoose={setAccountType} prefill={prefill} lang={lang} />
        )}

        {/* Wizard Individuel */}
        {accountType==="INDIVIDUAL" && !showAuth && (
          <IndividualWizard onBack={()=>setAccountType(null)} onDone={handleWizardDone} prefill={prefill} lang={lang} />
        )}

        {/* Wizard Entreprise */}
        {accountType==="BUSINESS" && !showAuth && (
          <BusinessWizard onBack={()=>setAccountType(null)} onDone={handleWizardDone} prefill={{ email:prefill.email }} lang={lang} />
        )}

        {/* Auth */}
        {showAuth && (
          <AuthStep
            data={formData}
            onBack={()=>setShowAuth(false)}
            onDone={createAccount}
            saving={saving}
            error={error}
            lang={lang}
          />
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:"100vh", display:"grid", placeItems:"center" }}>
        <div style={{ width:36, height:36, border:"4px solid #fee2e2", borderTopColor:"#E5342A", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
