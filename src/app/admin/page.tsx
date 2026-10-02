import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { NavWrapper } from "@/components/NavWrapper";
import { db } from "@/lib/db";
import { users, organizations, fiscalDocuments, taxReturns } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-helpers";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const ctx = await requireAdmin();
  if (!ctx) redirect("/dashboard");

  const [userCount] = await db.select({ count: count() }).from(users);
  const [orgCount]  = await db.select({ count: count() }).from(organizations);
  const [docCount]  = await db.select({ count: count() }).from(fiscalDocuments);
  const [retCount]  = await db.select({ count: count() }).from(taxReturns);

  const recentUsers = await db.select({
    id: users.id, email: users.email, firstName: users.firstName,
    lastName: users.lastName, role: users.role, status: users.status, createdAt: users.createdAt,
  }).from(users).orderBy(users.createdAt).limit(10);

  const recentOrgs = await db.select({
    id: organizations.id, legalName: organizations.legalName,
    type: organizations.type, status: organizations.status,
    province: organizations.province, createdAt: organizations.createdAt,
  }).from(organizations).orderBy(organizations.createdAt).limit(5);

  const isSuperAdmin = ctx.role === "SUPER_ADMIN";

  const roleColors: Record<string, { bg: string; text: string }> = {
    INDIVIDUAL:  { bg: "rgba(107,114,128,0.1)",  text: "#6B7280" },
    PREPARER:    { bg: "rgba(37,99,235,0.1)",     text: "#2563EB" },
    BUSINESS:    { bg: "rgba(124,58,237,0.1)",    text: "#7C3AED" },
    ADMIN:       { bg: "rgba(217,119,6,0.1)",     text: "#D97706" },
    SUPER_ADMIN: { bg: "rgba(229,52,42,0.12)",    text: "#E5342A" },
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavWrapper />
      <main style={{ maxWidth: 1050, margin: "0 auto", padding: "32px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            Console d&apos;administration
          </h1>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100,
            background: isSuperAdmin ? "rgba(229,52,42,0.12)" : "rgba(217,119,6,0.12)",
            color: isSuperAdmin ? "var(--et-red)" : "#D97706",
            letterSpacing: "0.06em",
          }}>
            {isSuperAdmin ? "SUPER ADMIN" : "ADMIN"}
          </span>
        </div>

        {/* Stats globales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Utilisateurs", value: Number(userCount.count), icon: "👤", color: "#2563EB" },
            { label: "Organisations", value: Number(orgCount.count),  icon: "🏢", color: "#7C3AED" },
            { label: "Documents",    value: Number(docCount.count),   icon: "📄", color: "#16A34A" },
            { label: "Déclarations", value: Number(retCount.count),   icon: "📋", color: "#D97706" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 16, padding: "18px 16px", boxShadow: "var(--shadow-sm)",
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, fontSize: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: `${color}18`, marginBottom: 10,
              }}>{icon}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Utilisateurs récents */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 18, padding: "20px 22px", boxShadow: "var(--shadow-sm)", marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 16px" }}>
            Utilisateurs récents
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Utilisateur", "Rôle", "Statut", "Inscrit le"].map(h => (
                    <th key={h} style={{
                      textAlign: "left", fontSize: 11, fontWeight: 600,
                      color: "var(--text-muted)", textTransform: "uppercase",
                      letterSpacing: "0.05em", paddingBottom: 10, paddingRight: 16,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => {
                  const rc = roleColors[u.role] ?? roleColors.INDIVIDUAL;
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "11px 16px 11px 0" }}>
                        <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                          {u.firstName ?? ""} {u.lastName ?? ""}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email}</div>
                      </td>
                      <td style={{ padding: "11px 16px 11px 0" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 100,
                          background: rc.bg, color: rc.text,
                        }}>{u.role}</span>
                      </td>
                      <td style={{ padding: "11px 16px 11px 0" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 100,
                          background: u.status === "active" ? "rgba(22,163,74,0.1)" : "var(--bg-card-hover)",
                          color: u.status === "active" ? "#16A34A" : "var(--text-muted)",
                        }}>{u.status}</span>
                      </td>
                      <td style={{ padding: "11px 0 11px 0", fontSize: 12, color: "var(--text-muted)" }}>
                        {u.createdAt.toLocaleDateString("fr-CA")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Organisations récentes */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 18, padding: "20px 22px", boxShadow: "var(--shadow-sm)", marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 14px" }}>
            Organisations récentes
          </h2>
          {recentOrgs.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune organisation créée.</p>
          ) : (
            <div>
              {recentOrgs.map((org, i) => (
                <div key={org.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 0",
                  borderBottom: i < recentOrgs.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div>
                    <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 14 }}>{org.legalName}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {org.type} · {org.province ?? "—"} · {org.createdAt.toLocaleDateString("fr-CA")}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 100,
                    background: org.status === "active" ? "rgba(22,163,74,0.1)" : "var(--bg-card-hover)",
                    color: org.status === "active" ? "#16A34A" : "var(--text-muted)",
                  }}>{org.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Super Admin uniquement */}
        {isSuperAdmin && (
          <div style={{
            border: "1.5px solid rgba(229,52,42,0.3)", borderRadius: 18,
            padding: "20px 22px", background: "rgba(229,52,42,0.04)",
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--et-red)", margin: "0 0 14px" }}>
              ⚠️ Zone Super Administrateur
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10 }}>
              {[
                { label: "Règles fiscales", icon: "📊" },
                { label: "Juridictions",    icon: "🗺️" },
                { label: "Migrations DB",   icon: "🗄️" },
                { label: "Audit complet",   icon: "📋" },
              ].map(({ label, icon }) => (
                <div key={label} style={{
                  background: "var(--bg-card)", border: "1px solid rgba(229,52,42,0.2)",
                  borderRadius: 12, padding: "14px 16px", textAlign: "center",
                  cursor: "pointer",
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--et-red)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
