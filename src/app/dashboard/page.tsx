import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NavWrapper } from "@/components/NavWrapper";
import { db } from "@/lib/db";
import { users, fiscalDocuments, taxReturns, taxProfiles } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import {
  FileText, FolderOpen, BarChart3, ChevronRight,
  Upload, HelpCircle, Building2,
} from "lucide-react";

export default async function DashboardPage() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/sign-in");

  const clerkUser = await currentUser();

  let easyTaxUser = null;
  try {
    const rows = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
    if (!rows[0]) {
      // Nouvel utilisateur — créer sans onboarding et rediriger vers le wizard
      await db.insert(users).values({
        clerkUserId,
        email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? "",
        firstName: clerkUser?.firstName ?? null,
        lastName: clerkUser?.lastName ?? null,
        role: "INDIVIDUAL",
        status: "active",
        onboardingCompleted: false,
        lastSignInAt: new Date(),
      });
      redirect("/onboarding");
    } else {
      easyTaxUser = rows[0];
      // Onboarding pas encore complété → wizard
      if (!easyTaxUser.onboardingCompleted) redirect("/onboarding");
      // Onboarding complété MAIS tax_profile manquant (compte créé avant le wizard)
      const profileCheck = await db.select({ id: taxProfiles.id })
        .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
      if (!profileCheck[0]) redirect("/onboarding");
      await db.update(users).set({ lastSignInAt: new Date(), updatedAt: new Date() }).where(eq(users.clerkUserId, clerkUserId));
    }
  } catch (e: unknown) {
    // redirect() lance une erreur intentionnelle en Next.js — la laisser passer
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    console.error("user sync:", e);
  }

  // Vérifier si le profil fiscal est complet (pour bannière d'alerte)
  let hasProfile = false;
  try {
    const profileRows = await db.select({ id: taxProfiles.id, firstName: taxProfiles.firstName, province: taxProfiles.province })
      .from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId ?? "")).limit(1);
    hasProfile = !!(profileRows[0]?.firstName && profileRows[0]?.province);
  } catch { /* silencieux */ }

  let docCount = 0, returnCount = 0;
  try {
    const [dc] = await db.select({ count: count() }).from(fiscalDocuments).where(eq(fiscalDocuments.userId, clerkUserId));
    docCount = Number(dc.count);
  } catch (e) { console.error(e); }
  try {
    const profile = await db.select({ id: taxProfiles.id }).from(taxProfiles).where(eq(taxProfiles.userId, clerkUserId)).limit(1);
    if (profile[0]) {
      const [rc] = await db.select({ count: count() }).from(taxReturns).where(eq(taxReturns.profileId, profile[0].id));
      returnCount = Number(rc.count);
    }
  } catch (e) { console.error(e); }

  const firstName = easyTaxUser?.firstName ?? clerkUser?.firstName ?? "là";

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh" }}>
      <NavWrapper />

      {/* Bannière alerte profil incomplet */}
      {!hasProfile && (
        <div style={{
          background: "rgba(229,52,42,0.08)",
          borderBottom: "2px solid rgba(229,52,42,0.3)",
          padding: "14px 20px",
        }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--et-red)" }}>
                  Votre profil fiscal est incomplet
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Complétez votre profil pour uploader des documents et produire votre déclaration 2025.
                </div>
              </div>
            </div>
            <a href="/onboarding" style={{
              padding: "10px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: "var(--et-red)", color: "#fff", textDecoration: "none", flexShrink: 0,
              whiteSpace: "nowrap",
            }}>
              Compléter mon profil →
            </a>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              Bonjour, {firstName} 👋
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Saison fiscale 2025 — Dossier en cours
            </p>
          </div>
          <Link href="/dossier" className="et-btn et-btn-primary self-start sm:self-auto">
            Mon dossier fiscal
            <ChevronRight size={15} />
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Documents", value: docCount, icon: FileText, href: "/documents", color: "#2563EB" },
            { label: "Mon dossier", value: returnCount, icon: FolderOpen, href: "/dossier", color: "#7C3AED" },
            { label: "Résumé fiscal", value: "—", icon: BarChart3, href: "/resume", color: "#16A34A" },
            { label: "Business", value: "—", icon: Building2, href: "/business", color: "#D97706" },
          ].map(({ label, value, icon: Icon, href, color }) => (
            <Link key={href} href={href} className="et-stat hover:no-underline group">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg" style={{ background: `${color}18` }}>
                  <Icon size={16} style={{ color }} strokeWidth={1.8} />
                </div>
                <ChevronRight size={14} style={{ color: "var(--text-muted)" }} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
              <div className="text-2xl font-bold mb-0.5" style={{ color: "var(--text-primary)" }}>{value}</div>
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</div>
            </Link>
          ))}
        </div>

        {/* Actions rapides */}
        <div>
          <p className="et-section-title">Actions rapides</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                href: "/dossier",
                icon: Upload,
                title: "Téléverser mes documents",
                desc: "T4, RL-1, T5 — l'IA extrait les données automatiquement",
                color: "#2563EB",
              },
              {
                href: "/questionnaire",
                icon: HelpCircle,
                title: "Compléter le questionnaire",
                desc: "Questions non couvertes par les feuillets",
                color: "#7C3AED",
              },
              {
                href: "/resume",
                icon: BarChart3,
                title: "Voir le résumé",
                desc: "Remboursement estimé et calculs",
                color: "#16A34A",
              },
            ].map(({ href, icon: Icon, title, desc, color }) => (
              <Link
                key={href}
                href={href}
                className="et-card p-5 flex gap-4 items-start hover:no-underline group"
              >
                <div className="p-2.5 rounded-xl shrink-0 mt-0.5" style={{ background: `${color}18` }}>
                  <Icon size={18} style={{ color }} strokeWidth={1.8} />
                </div>
                <div>
                  <div className="font-semibold text-sm mb-0.5 group-hover:underline" style={{ color: "var(--text-primary)" }}>
                    {title}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{desc}</div>
                </div>
                <ChevronRight size={14} className="ml-auto mt-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform" style={{ color: "var(--text-muted)" }} />
              </Link>
            ))}
          </div>
        </div>

        {/* Progression déclaration */}
        <div>
          <p className="et-section-title">Progression 2025</p>
          <div className="et-card p-6">
            <div className="space-y-3">
              {[
                { label: "Identité et profil fiscal", done: true },
                { label: "Documents téléversés", done: docCount > 0 },
                { label: "Questionnaire complété", done: false },
                { label: "Données validées", done: false },
                { label: "Déclaration fédérale T1", done: false },
                { label: "Déclaration Québec TP-1", done: false },
              ].map(({ label, done }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 py-2 border-b last:border-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                    style={{
                      background: done ? "rgba(22,163,74,0.15)" : "var(--bg-card-hover)",
                      color: done ? "#16A34A" : "var(--text-muted)",
                    }}
                  >
                    {done ? "✓" : "·"}
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: done ? "var(--text-primary)" : "var(--text-secondary)" }}
                  >
                    {label}
                  </span>
                  {done && <span className="ml-auto et-badge et-badge-green text-[10px]">Complété</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
