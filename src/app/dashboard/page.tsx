import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { users, fiscalDocuments, taxReturns, taxProfiles } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export default async function DashboardPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const clerkUser = await currentUser();

  // Sync user
  let easyTaxUser = null;
  try {
    const rows = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
    if (!rows[0]) {
      const [created] = await db.insert(users).values({
        clerkUserId,
        email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? "",
        firstName: clerkUser?.firstName ?? null,
        lastName: clerkUser?.lastName ?? null,
        role: "INDIVIDUAL",
        status: "active",
        onboardingCompleted: true,
        lastSignInAt: new Date(),
      }).returning();
      easyTaxUser = created;
    } else {
      easyTaxUser = rows[0];
      await db.update(users).set({ lastSignInAt: new Date(), updatedAt: new Date() }).where(eq(users.clerkUserId, clerkUserId));
    }
  } catch (e) { console.error("user sync:", e); }

  // Stats réelles
  let docCount = 0;
  let returnCount = 0;

  try {
    const [dc] = await db.select({ count: count() }).from(fiscalDocuments).where(eq(fiscalDocuments.userId, clerkUserId));
    docCount = Number(dc.count);
  } catch (e) { console.error("docCount:", e); }

  try {
    const profile = await db.select({ id: taxProfiles.id }).from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
    if (profile[0]) {
      const [rc] = await db.select({ count: count() }).from(taxReturns).where(eq(taxReturns.profileId, profile[0].id));
      returnCount = Number(rc.count);
    }
  } catch (e) { console.error("returnCount:", e); }

  const firstName = easyTaxUser?.firstName ?? clerkUser?.firstName ?? "là";

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-bold text-red-600">Easy</span>
          <span className="text-xl font-bold text-gray-900">Tax</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/documents" className="text-sm text-gray-500 hover:text-gray-900">Documents</Link>
          <Link href="/dossier" className="text-sm text-gray-500 hover:text-gray-900">Dossier</Link>
          <Link href="/questionnaire" className="text-sm text-gray-500 hover:text-gray-900">Questionnaire</Link>
          <Link href="/resume" className="text-sm text-gray-500 hover:text-gray-900">Résumé fiscal</Link>
          <Link href="/business" className="text-sm text-gray-500 hover:text-gray-900">Business</Link>
          <Link href="/preparer" className="text-sm text-gray-500 hover:text-gray-900">Préparateur</Link>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-900">Admin</Link>
          <UserButton />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Bonjour {firstName} 👋</h1>
          <p className="text-gray-500 mt-1 text-sm">Saison fiscale 2025</p>
        </div>

        {/* Vraies stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Link href="/documents" className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-red-200 transition-colors">
            <div className="text-3xl mb-2">📄</div>
            <div className="text-3xl font-black text-gray-900">{docCount}</div>
            <div className="text-xs text-gray-500 mt-1">Documents</div>
          </Link>
          <Link href="/dossier" className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:border-red-200 transition-colors">
            <div className="text-3xl mb-2">📋</div>
            <div className="text-3xl font-black text-gray-900">{returnCount}</div>
            <div className="text-xs text-gray-500 mt-1">Déclarations</div>
          </Link>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="text-3xl mb-2">💰</div>
            <div className="text-3xl font-black text-gray-900">—</div>
            <div className="text-xs text-gray-500 mt-1">Remboursement</div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-4">
          <h2 className="font-bold text-gray-900 mb-4">Actions rapides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/documents" className="flex items-center gap-3 border border-gray-100 rounded-xl p-4 hover:border-red-200 hover:bg-red-50/30 transition-colors">
              <span className="text-2xl">📄</span>
              <div>
                <div className="font-medium text-gray-900 text-sm">Ajouter un document</div>
                <div className="text-xs text-gray-500">T4, RL-1, T5, reçus…</div>
              </div>
            </Link>
            <Link href="/dossier" className="flex items-center gap-3 border border-gray-100 rounded-xl p-4 hover:border-red-200 hover:bg-red-50/30 transition-colors">
              <span className="text-2xl">📋</span>
              <div>
                <div className="font-medium text-gray-900 text-sm">Mon dossier fiscal</div>
                <div className="text-xs text-gray-500">Profil, employeurs, foyer</div>
              </div>
            </Link>
          </div>
        </div>

        {docCount === 0 && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-800">
            <strong>Commencez par ajouter vos documents fiscaux.</strong><br />
            T4, RL-1, T5 — ajoutez-les dans la section Documents pour démarrer votre déclaration.
          </div>
        )}
      </div>
    </main>
  );
}
