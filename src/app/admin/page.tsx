import { AppNav } from "@/components/AppNav";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { users, organizations, fiscalDocuments, taxReturns } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-helpers";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // VÉRIFICATION ADMIN CÔTÉ SERVEUR — ne jamais faire ça uniquement en frontend
  const ctx = await requireAdmin();
  if (!ctx) redirect("/dashboard");

  // Stats globales
  const [userCount] = await db.select({ count: count() }).from(users);
  const [orgCount] = await db.select({ count: count() }).from(organizations);
  const [docCount] = await db.select({ count: count() }).from(fiscalDocuments);
  const [returnCount] = await db.select({ count: count() }).from(taxReturns);

  // 10 derniers utilisateurs
  const recentUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt)
    .limit(10);

  // 5 dernières organisations
  const recentOrgs = await db
    .select({
      id: organizations.id,
      legalName: organizations.legalName,
      type: organizations.type,
      status: organizations.status,
      province: organizations.province,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .orderBy(organizations.createdAt)
    .limit(5);

  const isSuperAdmin = ctx.role === "SUPER_ADMIN";

  return (
    <main style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <AppNav />

            <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Console d&apos;administration</h1>
          <p className="text-sm text-gray-400 mt-1">Vue globale de la plateforme EasyTax</p>
        </div>

        {/* Stats globales */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Utilisateurs", value: Number(userCount.count), icon: "👤", color: "blue" },
            { label: "Organisations", value: Number(orgCount.count), icon: "🏢", color: "purple" },
            { label: "Documents", value: Number(docCount.count), icon: "📄", color: "green" },
            { label: "Déclarations", value: Number(returnCount.count), icon: "📋", color: "amber" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="text-xl mb-1">{stat.icon}</div>
              <div className="text-2xl font-black text-gray-900">{stat.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Utilisateurs récents */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Utilisateurs récents</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="pb-3 font-medium">Utilisateur</th>
                  <th className="pb-3 font-medium">Rôle</th>
                  <th className="pb-3 font-medium">Statut</th>
                  <th className="pb-3 font-medium">Créé le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3">
                      <div className="font-medium text-gray-900">
                        {u.firstName ?? ""} {u.lastName ?? ""}
                      </div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                    </td>
                    <td className="py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.status === "active"
                          ? "bg-green-50 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-gray-400">
                      {u.createdAt.toLocaleDateString("fr-CA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Organisations récentes */}
        <section className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-bold text-gray-900 mb-4">Organisations récentes</h2>
          {recentOrgs.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune organisation créée.</p>
          ) : (
            <div className="space-y-2">
              {recentOrgs.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{org.legalName}</div>
                    <div className="text-xs text-gray-400">
                      {org.type} · {org.province ?? "—"} · Créé {org.createdAt.toLocaleDateString("fr-CA")}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    org.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {org.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Super Admin uniquement */}
        {isSuperAdmin && (
          <section className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <h2 className="font-bold text-red-900 mb-4">⚠️ Zone Super Administrateur</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Règles fiscales", href: "/admin/tax-rules", icon: "📊" },
                { label: "Juridictions", href: "/admin/jurisdictions", icon: "🗺️" },
                { label: "Migrations DB", href: "/api/admin/migrate", icon: "🗄️" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="bg-white border border-red-200 rounded-xl p-4 text-sm font-medium text-red-700 hover:bg-red-50 transition-colors text-center"
                >
                  <div className="text-xl mb-1">{item.icon}</div>
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    INDIVIDUAL: "bg-gray-100 text-gray-600",
    PREPARER: "bg-blue-50 text-blue-700",
    BUSINESS: "bg-purple-50 text-purple-700",
    ADMIN: "bg-amber-50 text-amber-700",
    SUPER_ADMIN: "bg-red-50 text-red-700",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[role] ?? "bg-gray-100 text-gray-600"}`}>
      {role}
    </span>
  );
}
