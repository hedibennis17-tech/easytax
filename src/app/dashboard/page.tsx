import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { users, taxProfiles, taxReturns, fiscalDocuments } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export default async function DashboardPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const clerkUser = await currentUser();

  // Récupérer l'utilisateur EasyTax
  const easyTaxUser = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  // Si pas encore synced, rediriger vers onboarding
  if (!easyTaxUser[0]) redirect("/onboarding");
  if (!easyTaxUser[0].onboardingCompleted) redirect("/onboarding");

  const user = easyTaxUser[0];
  const firstName = user.firstName ?? clerkUser?.firstName ?? "là";

  // Stats rapides
  const [docCount] = await db
    .select({ count: count() })
    .from(fiscalDocuments)
    .where(eq(fiscalDocuments.userId, clerkUserId));

  const [returnCount] = await db
    .select({ count: count() })
    .from(taxReturns)
    .innerJoin(taxProfiles, eq(taxReturns.profileId, taxProfiles.id))
    .where(eq(taxProfiles.userId, clerkUserId));

  const roleLabels: Record<string, string> = {
    INDIVIDUAL: "Particulier",
    PREPARER: "Préparateur fiscal",
    BUSINESS: "Entreprise",
    ADMIN: "Administrateur",
    SUPER_ADMIN: "Super Admin",
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-bold text-red-600">Easy</span>
          <span className="text-xl font-bold text-gray-900">Tax</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/dossier" className="text-sm text-gray-500 hover:text-gray-900">Mon dossier</Link>
          <Link href="/documents" className="text-sm text-gray-500 hover:text-gray-900">Documents</Link>
          {(user.role === "ADMIN" || user.role === "SUPER_ADMIN") && (
            <Link href="/admin" className="text-sm text-red-600 font-medium hover:text-red-700">Admin</Link>
          )}
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {roleLabels[user.role] ?? user.role}
          </span>
          <UserButton />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour {firstName} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Saison fiscale 2025 — Votre espace EasyTax
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Documents", value: docCount.count, icon: "📄", href: "/documents" },
            { label: "Déclarations", value: returnCount.count, icon: "📋", href: "/dossier" },
            { label: "Remboursement estimé", value: "—", icon: "💰", href: "/dossier" },
          ].map((stat) => (
            <Link key={stat.label} href={stat.href}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-red-200 transition-colors">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
            </Link>
          ))}
        </div>

        {/* Actions rapides */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">🚀 Actions rapides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/documents"
              className="flex items-center gap-3 border border-gray-100 rounded-xl p-4 hover:border-red-200 hover:bg-red-50/30 transition-colors">
              <span className="text-2xl">📄</span>
              <div>
                <div className="font-medium text-gray-900 text-sm">Ajouter un document</div>
                <div className="text-xs text-gray-500">T4, RL-1, T5, reçus…</div>
              </div>
            </Link>
            <Link href="/dossier"
              className="flex items-center gap-3 border border-gray-100 rounded-xl p-4 hover:border-red-200 hover:bg-red-50/30 transition-colors">
              <span className="text-2xl">📋</span>
              <div>
                <div className="font-medium text-gray-900 text-sm">Mon dossier fiscal</div>
                <div className="text-xs text-gray-500">Profil, employeurs, foyer</div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
