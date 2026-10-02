"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ORG_TYPES = [
  { value: "BUSINESS", label: "Entreprise incorporée", icon: "🏛️", desc: "Inc., Ltd., Corp., s.e.n.c.r.l." },
  { value: "SOLE_PROPRIETORSHIP", label: "Entreprise individuelle", icon: "🧑‍💼", desc: "Travailleur autonome enregistré" },
  { value: "TAX_FIRM", label: "Cabinet comptable / fiscal", icon: "⚖️", desc: "CPA, comptable, préparateur" },
];

export default function NewOrgPage() {
  const router = useRouter();
  const [step, setStep] = useState<"type" | "info">("type");
  const [orgType, setOrgType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    legalName: "",
    tradeName: "",
    province: "",
    address: "",
    city: "",
    postalCode: "",
    phone: "",
    email: "",
  });

  const PROVINCES = [
    "QC", "ON", "BC", "AB", "SK", "MB", "NB", "NS", "PE", "NL", "NT", "NU", "YT",
  ];

  const handleCreate = async () => {
    if (!form.legalName.trim()) {
      setError("Le nom légal est requis");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: orgType }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur lors de la création");
        return;
      }

      const org = await res.json();
      router.push(`/business/${org.id}`);
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  if (step === "type") {
    return (
      <main className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-100 px-6 py-4">
          <Link href="/business" className="flex items-center gap-1 w-fit">
            <span className="text-xl font-bold text-red-600">Easy</span>
            <span className="text-xl font-bold text-gray-900">Tax</span>
          </Link>
        </nav>

        <div className="max-w-xl mx-auto px-6 py-12">
          <div className="mb-8">
            <Link href="/business" className="text-sm text-gray-400 hover:text-gray-700">← Retour</Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-4">Quel type d&apos;organisation ?</h1>
          </div>

          <div className="space-y-3">
            {ORG_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => { setOrgType(t.value); setStep("info"); }}
                className="w-full bg-white border border-gray-200 rounded-2xl p-5 text-left hover:border-red-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{t.icon}</span>
                  <div>
                    <div className="font-semibold text-gray-900 group-hover:text-red-700">{t.label}</div>
                    <div className="text-sm text-gray-400">{t.desc}</div>
                  </div>
                  <span className="ml-auto text-gray-300 group-hover:text-red-400">→</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const selectedType = ORG_TYPES.find((t) => t.value === orgType);

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4">
        <Link href="/business" className="flex items-center gap-1 w-fit">
          <span className="text-xl font-bold text-red-600">Easy</span>
          <span className="text-xl font-bold text-gray-900">Tax</span>
        </Link>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="mb-8">
          <button onClick={() => setStep("type")} className="text-sm text-gray-400 hover:text-gray-700">← Retour</button>
          <div className="flex items-center gap-3 mt-4">
            <span className="text-2xl">{selectedType?.icon}</span>
            <h1 className="text-2xl font-bold text-gray-900">{selectedType?.label}</h1>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom légal <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.legalName}
              onChange={(e) => setForm({ ...form, legalName: e.target.value })}
              placeholder="Entreprise ABC Inc."
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom commercial</label>
            <input
              type="text"
              value={form.tradeName}
              onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
              placeholder="ABC Solutions (optionnel)"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
              <select
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400 bg-white"
              >
                <option value="">— Sélectionner</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Montréal"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Courriel de l&apos;organisation</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="info@entreprise.ca"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-red-400"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full bg-red-600 text-white rounded-xl py-3 font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? "Création en cours..." : "Créer l'organisation →"}
          </button>
        </div>
      </div>
    </main>
  );
}
