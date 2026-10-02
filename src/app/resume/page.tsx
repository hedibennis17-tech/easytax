import { AppNav } from "@/components/AppNav";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

// Page résumé fiscal — données préliminaires uniquement
// Le Tax Engine fournit un aperçu — aucune transmission officielle

export default async function ResumePage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  return (
    <main style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <AppNav />

            <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Résumé fiscal 2025</h1>
          <p className="text-gray-400 text-sm mt-1">Estimations préliminaires — déclaration non transmise</p>
        </div>

        {/* Avertissement légal */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm text-amber-800">
            ⚠️ <strong>Résultats indicatifs uniquement.</strong> Ces chiffres sont générés par EasyTax à titre informatif.
            Aucune déclaration n&apos;a été transmise à l&apos;ARC ou à Revenu Québec.
            La transmission officielle sera disponible dans une étape ultérieure.
          </p>
        </div>

        {/* Revenus */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            💰 Revenus déclarés
          </h2>
          <div className="space-y-3 text-sm">
            <SummaryRow label="Revenus d'emploi (T4)" value="— $" status="pending" />
            <SummaryRow label="Travail autonome" value="— $" status="pending" />
            <SummaryRow label="Revenus de placement" value="— $" status="pending" />
            <SummaryRow label="Autres revenus" value="— $" status="pending" />
            <div className="pt-3 border-t border-gray-100 flex justify-between font-semibold text-gray-900">
              <span>Revenu total</span>
              <span>— $</span>
            </div>
          </div>

          <div className="mt-4">
            <Link
              href="/questionnaire"
              className="text-sm text-red-600 hover:underline"
            >
              + Compléter le questionnaire →
            </Link>
          </div>
        </section>

        {/* Déductions */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            📉 Déductions
          </h2>
          <div className="space-y-3 text-sm">
            <SummaryRow label="Cotisations REER" value="— $" status="pending" />
            <SummaryRow label="Frais de garde" value="— $" status="pending" />
            <SummaryRow label="Autres déductions" value="— $" status="pending" />
            <div className="pt-3 border-t border-gray-100 flex justify-between font-semibold text-gray-900">
              <span>Total déductions</span>
              <span>— $</span>
            </div>
          </div>
        </section>

        {/* Calcul fiscal */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-5 flex items-center gap-2">
            🧮 Calcul fiscal estimé
          </h2>

          {/* Comment on arrive au résultat */}
          <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm space-y-2">
            <p className="text-gray-500 text-xs font-semibold uppercase mb-3">Explication du calcul</p>
            <CalcRow label="Revenu total" value="— $" />
            <CalcRow label="− Déductions applicables" value="— $" indent />
            <CalcRow label="= Revenu net" value="— $" bold />
            <div className="border-t border-gray-200 pt-2 mt-2">
              <CalcRow label="→ Calcul fédéral (15–33%)" value="— $" />
              <CalcRow label="→ Calcul provincial QC (14–25,75%)" value="— $" />
              <CalcRow label="→ Montant personnel de base" value="— $" indent />
              <CalcRow label="→ Autres crédits" value="— $" indent />
            </div>
            <div className="border-t border-gray-200 pt-2 mt-2">
              <CalcRow label="Retenues à la source (T4)" value="— $" />
              <CalcRow label="= Résultat estimé" value="— $" bold />
            </div>
          </div>

          {/* Résultats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-xs text-blue-500 font-semibold mb-1">🇨🇦 Fédéral</p>
              <p className="text-2xl font-black text-blue-700">— $</p>
              <p className="text-xs text-blue-400 mt-1">En attente de données</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-xs text-purple-500 font-semibold mb-1">⚜️ Québec</p>
              <p className="text-2xl font-black text-purple-700">— $</p>
              <p className="text-xs text-purple-400 mt-1">En attente de données</p>
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <Link
            href="/questionnaire"
            className="flex-1 bg-red-600 text-white rounded-xl py-3 font-semibold text-sm text-center hover:bg-red-700 transition-colors"
          >
            Compléter le questionnaire →
          </Link>
          <Link
            href="/documents"
            className="px-6 py-3 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center"
          >
            Gérer les documents
          </Link>
        </div>
      </div>
    </main>
  );
}

function SummaryRow({
  label, value, status,
}: {
  label: string; value: string; status: "ok" | "pending" | "warning";
}) {
  const dot =
    status === "ok" ? "bg-green-400" :
    status === "warning" ? "bg-amber-400" :
    "bg-gray-300";

  return (
    <div className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className="text-gray-600">{label}</span>
      </div>
      <span className="font-medium text-gray-400">{value}</span>
    </div>
  );
}

function CalcRow({
  label, value, indent, bold,
}: {
  label: string; value: string; indent?: boolean; bold?: boolean;
}) {
  return (
    <div className={`flex justify-between text-xs ${indent ? "pl-4" : ""} ${bold ? "font-semibold text-gray-900" : "text-gray-500"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
