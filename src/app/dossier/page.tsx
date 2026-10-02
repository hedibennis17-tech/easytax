import { AppNav } from "@/components/AppNav";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-600" },
  in_progress: { label: "En cours", color: "bg-blue-100 text-blue-700" },
  review: { label: "En révision", color: "bg-yellow-100 text-yellow-700" },
  ready: { label: "Prêt", color: "bg-green-100 text-green-700" },
  submitted: { label: "Transmis", color: "bg-purple-100 text-purple-700" },
  accepted: { label: "Accepté", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejeté", color: "bg-red-100 text-red-700" },
  amended: { label: "Modifié", color: "bg-orange-100 text-orange-700" },
  cancelled: { label: "Annulé", color: "bg-gray-100 text-gray-500" },
};

// Données de démonstration — seront remplacées par les appels API à l'étape auth
const DEMO_PROFILE = {
  firstName: "Jean",
  lastName: "Tremblay",
  sinLastFour: "1234",
  province: "QC",
  maritalStatus: "married",
  isQuebecResident: true,
};

const DEMO_RETURN = {
  year: 2025,
  status: "in_progress",
  federalStatus: "in_progress",
  quebecStatus: "draft",
};

const DEMO_HOUSEHOLD = {
  spouse: { firstName: "Marie", lastName: "Tremblay" },
  dependents: [
    { firstName: "Lucas", lastName: "Tremblay", dateOfBirth: "2015-03-10", relation: "child" },
  ],
};

const DEMO_EMPLOYERS = [
  { legalName: "Entreprise ABC Inc.", year: 2025 },
  { legalName: "Startup XYZ Ltée", year: 2025 },
];

export default function DossierPage() {
  const returnStatus = STATUS_LABELS[DEMO_RETURN.status];
  const federalStatus = STATUS_LABELS[DEMO_RETURN.federalStatus];
  const quebecStatus = STATUS_LABELS[DEMO_RETURN.quebecStatus];

  return (
    <main style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      {/* Nav */}
      <AppNav />

            <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mon dossier fiscal</h1>
          <p className="text-gray-500 mt-1 text-sm">Saison fiscale {DEMO_RETURN.year}</p>
        </div>

        {/* Profil fiscal */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            👤 Profil fiscal
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400 block">Nom complet</span>
              <span className="font-medium text-gray-900">
                {DEMO_PROFILE.firstName} {DEMO_PROFILE.lastName}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">NAS</span>
              <span className="font-medium text-gray-900 font-mono">
                •••&nbsp;•••&nbsp;{DEMO_PROFILE.sinLastFour}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block">Province</span>
              <span className="font-medium text-gray-900">{DEMO_PROFILE.province}</span>
            </div>
            <div>
              <span className="text-gray-400 block">Situation</span>
              <span className="font-medium text-gray-900">Marié(e)</span>
            </div>
            <div>
              <span className="text-gray-400 block">Résident Québec</span>
              <span className="font-medium text-gray-900">
                {DEMO_PROFILE.isQuebecResident ? "Oui" : "Non"}
              </span>
            </div>
          </div>
          <button className="mt-4 text-sm text-red-600 hover:underline">
            Modifier mon profil →
          </button>
        </section>

        {/* Statut de la déclaration */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            📋 Déclaration {DEMO_RETURN.year}
          </h2>
          <div className="flex flex-wrap gap-3 mb-4">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${returnStatus.color}`}>
              Global : {returnStatus.label}
            </span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${federalStatus.color}`}>
              🇨🇦 Fédéral : {federalStatus.label}
            </span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${quebecStatus.color}`}>
              ⚜️ Québec : {quebecStatus.label}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            {[
              { label: "Identité", done: true },
              { label: "Situation familiale", done: true },
              { label: "Revenus", done: false },
              { label: "Documents fiscaux", done: false },
              { label: "Dépenses et crédits", done: false },
              { label: "Déclaration fédérale T1", done: false },
              { label: "Déclaration Québec TP-1", done: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-700">{item.label}</span>
                <span>{item.done ? "✅" : "⏳"}</span>
              </div>
            ))}
          </div>
          <button className="mt-5 w-full bg-red-600 text-white rounded-xl py-3 font-semibold hover:bg-red-700 transition-colors text-sm">
            Continuer ma déclaration →
          </button>
        </section>

        {/* Foyer */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            🏠 Foyer fiscal
          </h2>

          {/* Conjoint */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Conjoint(e)</h3>
            {DEMO_HOUSEHOLD.spouse ? (
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                  {DEMO_HOUSEHOLD.spouse.firstName[0]}
                </div>
                <div className="text-sm">
                  <div className="font-medium text-gray-900">
                    {DEMO_HOUSEHOLD.spouse.firstName} {DEMO_HOUSEHOLD.spouse.lastName}
                  </div>
                  <div className="text-gray-400">Profil lié</div>
                </div>
              </div>
            ) : (
              <button className="text-sm text-red-600 hover:underline">+ Ajouter un conjoint</button>
            )}
          </div>

          {/* Personnes à charge */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">
              Personnes à charge ({DEMO_HOUSEHOLD.dependents.length})
            </h3>
            <div className="space-y-2">
              {DEMO_HOUSEHOLD.dependents.map((dep) => (
                <div key={dep.firstName} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-sm">
                    {dep.firstName[0]}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {dep.firstName} {dep.lastName}
                    </div>
                    <div className="text-gray-400">
                      Né(e) le {dep.dateOfBirth} · Enfant
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-2 text-sm text-red-600 hover:underline">
              + Ajouter une personne à charge
            </button>
          </div>
        </section>

        {/* Employeurs */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            💼 Employeurs — {DEMO_RETURN.year}
          </h2>
          <div className="space-y-2">
            {DEMO_EMPLOYERS.map((emp) => (
              <div key={emp.legalName} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 text-sm">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-xs">
                  {emp.legalName[0]}
                </div>
                <span className="font-medium text-gray-900">{emp.legalName}</span>
              </div>
            ))}
          </div>
          <button className="mt-3 text-sm text-red-600 hover:underline">
            + Ajouter un employeur
          </button>
        </section>

        {/* Travail autonome */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
            🧑‍💼 Travail autonome
          </h2>
          <p className="text-sm text-gray-400 mb-3">
            Aucune activité autonome enregistrée pour {DEMO_RETURN.year}.
          </p>
          <button className="text-sm text-red-600 hover:underline">
            + Ajouter une activité autonome
          </button>
        </section>

      </div>
    </main>
  );
}
