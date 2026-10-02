"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useApp } from "./ThemeProvider";
import {
  LayoutDashboard, FileText, FolderOpen, HelpCircle, BarChart3,
  Building2, Users, ShieldCheck, Sun, Moon, Menu, X, Globe, ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard",     icon: LayoutDashboard, fr: "Tableau de bord",  en: "Dashboard"    },
  { href: "/documents",     icon: FileText,         fr: "Documents",        en: "Documents"    },
  { href: "/dossier",       icon: FolderOpen,       fr: "Mon dossier",      en: "My file"      },
  { href: "/questionnaire", icon: HelpCircle,       fr: "Questionnaire",    en: "Questionnaire"},
  { href: "/resume",        icon: BarChart3,        fr: "Résumé fiscal",    en: "Tax summary"  },
  { href: "/business",      icon: Building2,        fr: "Business",         en: "Business"     },
  { href: "/preparer",      icon: Users,            fr: "Préparateur",      en: "Preparer"     },
  { href: "/admin",         icon: ShieldCheck,      fr: "Admin",            en: "Admin"        },
] as const;

export function AppNav() {
  const { theme, toggleTheme, lang, toggleLang, t } = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* ── Barre principale ─────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--nav-bg)",
        borderBottom: "1px solid var(--nav-border)",
        boxShadow: "var(--shadow-nav)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          padding: "0 16px", height: 56,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0, textDecoration: "none" }}>
            <span className="et-logo-easy" style={{ fontSize: 21, fontWeight: 800, lineHeight: 1 }}>Easy</span>
            <span style={{ fontSize: 21, fontWeight: 800, lineHeight: 1, color: "var(--text-primary)" }}>Tax</span>
            <span className="et-badge et-badge-red" style={{ marginLeft: 8, fontSize: 10, display: "none" }}
              ref={(el) => { if (el) el.style.display = "inline-flex"; }}>CA</span>
          </Link>

          {/* Nav desktop */}
          <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflowX: "auto" }}
               className="hide-mobile">
            {NAV_ITEMS.map(({ href, icon: Icon, fr, en }) => (
              <Link key={href} href={href} className="et-nav-link" data-active={isActive(href) ? "true" : undefined}
                style={isActive(href) ? { color: "var(--et-red)", background: "rgba(229,52,42,0.08)" } : {}}>
                <Icon size={14} strokeWidth={1.8} />
                <span style={{ fontSize: 13 }}>{t(fr, en)}</span>
              </Link>
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {/* Lang */}
            <button onClick={toggleLang} title={lang === "fr" ? "English" : "Français"}
              style={{
                width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg-card)", color: "var(--text-secondary)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 150ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
            >
              <Globe size={15} strokeWidth={1.8} />
            </button>

            {/* Theme */}
            <button onClick={toggleTheme} title={theme === "light" ? t("Mode sombre", "Dark mode") : t("Mode clair", "Light mode")}
              style={{
                width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg-card)", color: "var(--text-secondary)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 150ms",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
            >
              {theme === "light" ? <Moon size={15} strokeWidth={1.8} /> : <Sun size={15} strokeWidth={1.8} />}
            </button>

            {/* Avatar Clerk */}
            <div style={{ marginLeft: 2 }}>
              <UserButton />
            </div>

            {/* ── Hamburger — visible mobile/tablet ── */}
            <button
              onClick={() => setOpen(true)}
              className="show-mobile"
              aria-label={t("Ouvrir le menu", "Open menu")}
              style={{
                width: 38, height: 38, borderRadius: 10,
                border: "1.5px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                cursor: "pointer", marginLeft: 4,
                display: "none",          /* show-mobile CSS le passe à flex */
                alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                transition: "all 150ms",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <Menu size={19} strokeWidth={2} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Overlay ──────────────────────────────────────── */}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 40, backdropFilter: "blur(3px)",
        }} />
      )}

      {/* ── Drawer ───────────────────────────────────────── */}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(300px, 82vw)",
        background: "var(--bg-sidebar)",
        borderLeft: "1px solid var(--border)",
        zIndex: 41,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 280ms cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
        boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.15)" : "none",
      }}>
        {/* Header drawer */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="et-logo-easy" style={{ fontSize: 19, fontWeight: 800 }}>Easy</span>
            <span style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)" }}>Tax</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Fermer"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-card-hover)",
              color: "var(--text-secondary)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            <X size={15} />
          </button>
        </div>

        {/* Navigation links */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          <p style={{
            fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
            textTransform: "uppercase", letterSpacing: "0.08em",
            padding: "4px 12px 10px",
          }}>
            {t("Navigation", "Navigation")}
          </p>

          {NAV_ITEMS.map(({ href, icon: Icon, fr, en }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 14px", borderRadius: 12, marginBottom: 2,
                  textDecoration: "none",
                  background: active ? "rgba(229,52,42,0.09)" : "transparent",
                  color: active ? "var(--et-red)" : "var(--text-secondary)",
                  fontWeight: active ? 600 : 400,
                  transition: "all 120ms",
                }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Icon size={17} strokeWidth={1.8} />
                  <span style={{ fontSize: 14 }}>{t(fr, en)}</span>
                </span>
                <ChevronRight size={14} style={{ opacity: 0.35 }} />
              </Link>
            );
          })}
        </nav>

        {/* Footer drawer */}
        <div style={{
          borderTop: "1px solid var(--border)",
          padding: "12px 14px",
          display: "flex", gap: 8, flexShrink: 0,
          background: "var(--bg-sidebar)",
        }}>
          <button onClick={toggleLang}
            style={{
              flex: 1, height: 38, borderRadius: 10,
              border: "1px solid var(--border)", background: "var(--bg-card)",
              color: "var(--text-secondary)", fontSize: 13, fontWeight: 500,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            <Globe size={14} />
            {lang === "fr" ? "English" : "Français"}
          </button>
          <button onClick={toggleTheme}
            style={{
              flex: 1, height: 38, borderRadius: 10,
              border: "1px solid var(--border)", background: "var(--bg-card)",
              color: "var(--text-secondary)", fontSize: 13, fontWeight: 500,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {theme === "light"
              ? <><Moon size={14} />{t("Sombre", "Dark")}</>
              : <><Sun  size={14} />{t("Clair",  "Light")}</>
            }
          </button>
        </div>
      </aside>

      {/* ── CSS mobile/desktop ────────────────────────────── */}
      <style>{`
        @media (max-width: 1023px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
        @media (min-width: 1024px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </>
  );
}

/* ── Nav publique (pages marketing) ─────────────────────── */
export function PublicNav() {
  const { theme, toggleTheme, lang, toggleLang, t } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--nav-bg)", borderBottom: "1px solid var(--nav-border)",
        boxShadow: "var(--shadow-nav)", backdropFilter: "blur(12px)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "0 16px",
          height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <span className="et-logo-easy" style={{ fontSize: 21, fontWeight: 800 }}>Easy</span>
            <span style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>Tax</span>
            <span className="et-badge et-badge-red" style={{ marginLeft: 8, fontSize: 10 }}>CA</span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Lang + Theme — toujours visibles */}
            <button onClick={toggleLang} title={lang === "fr" ? "English" : "Français"}
              style={{
                width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg-card)", color: "var(--text-secondary)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              <Globe size={15} />
            </button>
            <button onClick={toggleTheme}
              style={{
                width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg-card)", color: "var(--text-secondary)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <Link href="/sign-in" style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              color: "var(--text-secondary)", textDecoration: "none",
            }}>{t("Connexion", "Sign in")}</Link>
            <Link href="/sign-up" className="et-btn et-btn-primary" style={{ fontSize: 13 }}>
              {t("Commencer", "Get started")}
            </Link>
          </div>
        </div>
      </nav>

      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(280px, 80vw)",
        background: "var(--bg-sidebar)", borderLeft: "1px solid var(--border)",
        zIndex: 41, transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 280ms cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 700, fontSize: 17, color: "var(--text-primary)" }}>Menu</span>
          <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
            <X size={18} />
          </button>
        </div>
        <nav style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { href: "/sign-in",  label: t("Connexion",        "Sign in")        },
            { href: "/sign-up",  label: t("Créer un compte",  "Create account") },
          ].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", borderRadius: 12, textDecoration: "none",
                color: "var(--text-secondary)", fontSize: 14,
              }}>
              {label}
              <ChevronRight size={14} style={{ opacity: 0.35 }} />
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
