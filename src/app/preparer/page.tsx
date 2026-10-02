import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { preparerProfiles, preparerClientAssignments, taxProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export default async function PreparerPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Profil préparateur — vérification côté serveur
  const [profile] = await db
    .select()
    .from(preparerProfiles)
    .where(eq(preparerProfiles.userId, userId))
    .limit(1);

  // Clients actifs si préparateur
  const clients = profile
    ? await db
        .select({
          assignmentId: preparerClientAssignments.id,
          status: preparerClientAssignments.status,
          assignedAt: preparerClientAssignments.assignedAt,
          authorizedTaxYears: preparerClientAssignments.authorizedTaxYears,
          clientId: taxProfiles.id,
          clientFirstName: taxProfiles.firstName,
          clientLastName: taxProfiles.lastName,
          clientProvince: taxProfiles.province,
        })
        .from(preparerClientAssignments)
        .innerJoin(taxProfiles, eq(preparerClientAssignments.clientProfileId, taxProfiles.id))
        .where(
          and(
            eq(preparerClientAssignments.preparerId, profile.id),
            eq(preparerClientAssignments.status, "active")
          )
        )
    : [];

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-xl font-bold text-red-600">Easy</span>
          <span className="text-xl font-bold text-gray-900">Tax</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">Dashboard</Link>
          <UserButton />
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Espace Préparateur</h1>
          <p className="text-sm text-gray-400 mt-1">Gérez vos clients et leurs dossiers fiscaux</p>
        </div>

        {!profile ? (
          <RegisterPreparerBanner />
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <StatCard value={clients.length} label="Clients actifs" icon="👥" />
              <StatCard value="—" label="Dossiers en cours" icon="📋" />
              <StatCard value="—" label="En attente révision" icon="⏳" />
            </div>

            {/* Liste clients */}
            <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-bold text-gray-900">Clients assignés</h2>
                <button className="text-sm text-red-600 hover:underline">+ Inviter un client</button>
              </div>

              {clients.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-3xl mb-3">👥</div>
                  <p className="text-sm text-gray-400">Aucun client assigné pour le moment.</p>
                  <p className="text-xs text-gray-300 mt-1">Invitez vos clients à vous autoriser l&apos;accès à leur dossier.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clients.map((c) => {
                    const years = c.authorizedTaxYears
                      ? (JSON.parse(c.authorizedTaxYears) as number[])
                      : [];

                    return (
                      <div
                        key={c.assignmentId}
                        className="flex items-center justify-between bg-gray-50 rounded-xl p-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-sm">
                            {c.clientFirstName?.[0] ?? "?"}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">
                              {c.clientFirstName} {c.clientLastName}
                            </div>
                            <div className="text-xs text-gray-400">
                              {c.clientProvince} · Années : {years.length > 0 ? years.join(", ") : "Toutes"}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Actif
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ value, label, icon }: { value: number | string; label: string; icon: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-black text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function RegisterPreparerBanner() {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
      <div className="text-4xl mb-4">🧑‍💼</div>
      <h2 className="font-bold text-gray-700 mb-2">Profil préparateur non configuré</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
        Pour accéder à l&apos;espace préparateur, vous devez d&apos;abord activer votre profil professionnel.
      </p>
      <button className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors">
        Activer mon profil préparateur →
      </button>
    </div>
  );
}
