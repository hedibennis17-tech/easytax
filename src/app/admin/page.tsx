import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NavWrapper } from "@/components/NavWrapper";
import { db } from "@/lib/db";
import { users, organizations, fiscalDocuments, taxReturns, taxProfiles, notifications } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-helpers";

async function getCount(query: Promise<{ count: number }[]>): Promise<number> {
  const res = await query;
  return Number((res as Array<{count: number}>)[0]?.count ?? 0);
}

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const ctx = await requireAdmin();
  if (!ctx) redirect("/dashboard");

  const isSuperAdmin = ctx.role === "SUPER_ADMIN";

  // ── Tous les counts en parallèle ─────────────────────────────────────────
  const [
    nUser, nOrg, nDoc, nReturn, nProfile,
    nInd, nBiz, nPrep, nNotif,
  ] = await Promise.all([
    getCount(db.select({ count: count() }).from(users)),
    getCount(db.select({ count: count() }).from(organizations)),
    getCount(db.select({ count: count() }).from(fiscalDocuments)),
    getCount(db.select({ count: count() }).from(taxReturns)),
    getCount(db.select({ count: count() }).from(taxProfiles)),
    getCount(db.select({ count: count() }).from(users).where(eq(users.role, "INDIVIDUAL"))),
    getCount(db.select({ count: count() }).from(users).where(eq(users.role, "BUSINESS"))),
    getCount(db.select({ count: count() }).from(users).where(eq(users.role, "PREPARER"))),
    getCount(db.select({ count: count() }).from(notifications).where(eq(notifications.isRead, false))),
  ]);

  // ── Activités récentes ────────────────────────────────────────────────────
  const [recentUsers, recentReturns, recentOrgs] = await Promise.all([
    db.select({
      id: users.id, email: users.email,
      firstName: users.firstName, lastName: users.lastName,
      role: users.role, status: users.status, createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt)).limit(8),

    db.select({
      id: taxReturns.id, status: taxReturns.status,
      updatedAt: taxReturns.updatedAt,
    }).from(taxReturns).orderBy(desc(taxReturns.updatedAt)).limit(6),

    db.select({
      id: organizations.id, legalName: organizations.legalName,
      type: organizations.type, status: organizations.status,
      province: organizations.province, createdAt: organizations.createdAt,
    }).from(organizations).orderBy(desc(organizations.createdAt)).limit(6),
  ]);

  const roleColors: Record<string, { bg: string; text: string }> = {
    INDIVIDUAL:  { bg: "rgba(37,99,235,0.1)",  text: "#2563EB" },
    PREPARER:    { bg: "rgba(5,150,105,0.1)",   text: "#059669" },
    BUSINESS:    { bg: "rgba(124,58,237,0.1)",  text: "#7C3AED" },
    ADMIN:       { bg: "rgba(217,119,6,0.1)",   text: "#D97706" },
    SUPER_ADMIN: { bg: "rgba(229,52,42,0.12)",  text: "#E5342A" },
  };

  const returnStatusMap: Record<string, { bg: string; text: string; label: string }> = {
    draft:       { bg: "rgba(107,114,128,0.1)", text: "#6B7280", label: "Brouillon"   },
    in_progress: { bg: "rgba(37,99,235,0.1)",   text: "#2563EB", label: "En cours"    },
    review:      { bg: "rgba(217,119,6,0.1)",   text: "#D97706", label: "En révision" },
    ready:       { bg: "rgba(22,163,74,0.1)",   text: "#16A34A", label: "Prêt"        },
    submitted:   { bg: "rgba(124,58,237,0.1)",  text: "#7C3AED", label: "Soumis"      },
    accepted:    { bg: "rgba(22,163,74,0.12)",  text: "#16A34A", label: "Accepté"     },
    rejected:    { bg: "rgba(220,38,38,0.1)",   text: "#DC2626", label: "Refusé"      },
  };

  const R = { borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavWrapper />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 16px" }}>

        {/* En-tête */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Console d&apos;administration
              </h1>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100, letterSpacing: "0.06em",
                background: isSuperAdmin ? "rgba(229,52,42,0.12)" : "rgba(217,119,6,0.12)",
                color: isSuperAdmin ? "#E5342A" : "#D97706",
              }}>
                {isSuperAdmin ? "SUPER ADMIN" : "ADMIN"}
              </span>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
              Toutes les activités individuelles, entreprises, déclarations et paramètres
            </p>
          </div>
          {nNotif > 0 && (
            <Link href="/admin/notifications" style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
              borderRadius: 10, background: "rgba(37,99,235,0.1)", color: "#2563EB",
              textDecoration: "none", fontSize: 13, fontWeight: 600, border: "1px solid rgba(37,99,235,0.2)",
            }}>
              🔔 {nNotif} notification{nNotif > 1 ? "s" : ""} non lue{nNotif > 1 ? "s" : ""}
            </Link>
          )}
        </div>

        {/* Stats globales */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Utilisateurs",    value: nUser,    icon: "👥", color: "#2563EB", href: "/admin/users"         },
            { label: "Profils fiscaux", value: nProfile, icon: "🗂️", color: "#7C3AED", href: "/admin/users"         },
            { label: "Organisations",   value: nOrg,     icon: "🏢", color: "#059669", href: "/admin/organizations" },
            { label: "Documents",       value: nDoc,     icon: "📄", color: "#D97706", href: "/admin/documents"     },
            { label: "Déclarations",    value: nReturn,  icon: "📋", color: "#E5342A", href: "/admin/declarations"  },
          ].map(({ label, value, icon, color, href }) => (
            <Link key={label} href={href} style={{ textDecoration: "none" }}>
              <div style={{ ...R, padding: "14px 12px", transition: "all 150ms" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}18`, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Répartition comptes */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Comptes individuels",  value: nInd,  icon: "👤",   color: "#2563EB", href: "/admin/users/individual" },
            { label: "Comptes entreprises",  value: nBiz,  icon: "🏢",   color: "#7C3AED", href: "/admin/users/business"   },
            { label: "Préparateurs fiscaux", value: nPrep, icon: "🧑‍💼", color: "#059669", href: "/admin/users/preparers"  },
          ].map(({ label, value, icon, color, href }) => (
            <Link key={label} href={href} style={{ textDecoration: "none" }}>
              <div style={{ ...R, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderColor: `${color}25`, borderWidth: 1.5 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}15`, flexShrink: 0 }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Activités récentes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>

          {/* Utilisateurs récents */}
          <div style={{ ...R, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Nouveaux utilisateurs</h2>
              <Link href="/admin/users" style={{ fontSize: 11, color: "var(--et-red)", textDecoration: "none", fontWeight: 600 }}>Voir tout →</Link>
            </div>
            <div>
              {recentUsers.map((u, i) => {
                const rc = roleColors[u.role] ?? roleColors.INDIVIDUAL;
                return (
                  <div key={u.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
                    borderBottom: i < recentUsers.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <div style={{ width: 30, height: 30, borderRadius: 50, fontSize: 11, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: rc.bg, color: rc.text }}>
                      {(u.firstName?.[0] ?? u.email?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {u.firstName ?? ""} {u.lastName ?? ""} {!u.firstName && !u.lastName ? u.email : ""}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{u.createdAt.toLocaleDateString("fr-CA")}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 100, flexShrink: 0, background: rc.bg, color: rc.text }}>{u.role}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Déclarations récentes */}
          <div style={{ ...R, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Déclarations récentes</h2>
              <Link href="/admin/declarations" style={{ fontSize: 11, color: "var(--et-red)", textDecoration: "none", fontWeight: 600 }}>Voir tout →</Link>
            </div>
            {recentReturns.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>Aucune déclaration</div>
            ) : (
              <div>
                {recentReturns.map((r, i) => {
                  const sc = returnStatusMap[r.status] ?? returnStatusMap.draft;
                  return (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0",
                      borderBottom: i < recentReturns.length - 1 ? "1px solid var(--border)" : "none",
                    }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>#{r.id.slice(0, 8)}</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.updatedAt.toLocaleDateString("fr-CA")}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: sc.bg, color: sc.text }}>{sc.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Entreprises récentes */}
        <div style={{ ...R, padding: "18px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Entreprises enregistrées</h2>
            <Link href="/admin/organizations" style={{ fontSize: 11, color: "var(--et-red)", textDecoration: "none", fontWeight: 600 }}>Voir tout →</Link>
          </div>
          {recentOrgs.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucune organisation créée.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
              {recentOrgs.map((org) => (
                <div key={org.id} style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{org.legalName}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 100, background: "rgba(124,58,237,0.1)", color: "#7C3AED" }}>{org.type}</span>
                    {org.province && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 100, background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>{org.province}</span>}
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 100, background: org.status === "active" ? "rgba(22,163,74,0.1)" : "var(--bg-card)", color: org.status === "active" ? "#16A34A" : "var(--text-muted)" }}>{org.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Liens rapides */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
          {[
            { label: "Historique audit",   icon: "📋", href: "/admin/audit"         },
            { label: "Règles fiscales",    icon: "⚖️",  href: "/admin/tax-rules"     },
            { label: "Impôts & Calculs",   icon: "🧮", href: "/admin/tax-rules"     },
            { label: "Notifications",      icon: "🔔", href: "/admin/notifications" },
            { label: "Paramètres système", icon: "⚙️",  href: "/admin/settings"      },
            { label: "Historiques",        icon: "📅", href: "/admin/audit"         },
          ].map(({ label, icon, href }) => (
            <Link key={label} href={href} style={{ textDecoration: "none", ...R, borderRadius: 13, padding: "14px 12px", textAlign: "center", display: "block" }}>
              <div style={{ fontSize: 22, marginBottom: 7 }}>{icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
            </Link>
          ))}
        </div>

        {/* Super Admin */}
        {isSuperAdmin && (
          <div style={{ border: "1.5px solid rgba(229,52,42,0.3)", borderRadius: 16, padding: "18px 20px", background: "rgba(229,52,42,0.03)" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--et-red)", margin: "0 0 6px" }}>⚠️ Zone Super Administrateur</h2>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 14px" }}>Configuration globale. Toutes les actions sont auditées.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              {[
                { label: "Gérer les admins",  icon: "🛡️" },
                { label: "Config. système",    icon: "🔧" },
                { label: "Versions fiscales",  icon: "📊" },
                { label: "Audit global",       icon: "🔍" },
                { label: "Migrations DB",      icon: "🗄️" },
              ].map(({ label, icon }) => (
                <div key={label} style={{ background: "var(--bg-card)", border: "1px solid rgba(229,52,42,0.2)", borderRadius: 11, padding: "12px", textAlign: "center", cursor: "pointer" }}>
                  <div style={{ fontSize: 20, marginBottom: 5 }}>{icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--et-red)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
