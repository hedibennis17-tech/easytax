"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useApp } from "./ThemeProvider";
import {
  LayoutDashboard, FolderOpen, FileText, HelpCircle, BarChart3,
  ClipboardList, Building2, Users, UserCheck, Receipt, Calculator,
  Settings, ShieldCheck, UsersRound, BookOpen, Landmark, ScrollText,
  Bell, Sun, Moon, Menu, X, Globe, ChevronRight, type LucideIcon,
} from "lucide-react";
import type { NavItem, UserRole } from "@/lib/workspace";

// Map iconName string → composant Lucide
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard, FolderOpen, FileText, HelpCircle, BarChart3,
  ClipboardList, Building2, Users, UserCheck, Receipt, Calculator,
  Settings, ShieldCheck, UsersRound, BookOpen, Landmark, ScrollText, Bell,
};

// Badge couleur par workspace
const WORKSPACE_COLORS: Record<UserRole, string> = {
  INDIVIDUAL:  "#2563EB",
  BUSINESS:    "#7C3AED",
  PREPARER:    "#059669",
  ADMIN:       "#D97706",
  SUPER_ADMIN: "#E5342A",
};

interface AppNavProps {
  navItems?: NavItem[];
  workspaceLabel?: { fr: string; en: string };
  role?: UserRole;
  homeHref?: string;
}

// Nav par défaut pour les pages client sans contexte serveur
const DEFAULT_INDIVIDUAL_NAV: NavItem[] = [
  { href: "/dashboard",     fr: "Tableau de bord",  en: "Dashboard",     iconName: "LayoutDashboard" },
  { href: "/dossier",       fr: "Mon dossier",       en: "My file",       iconName: "FolderOpen"      },
  { href: "/documents",     fr: "Documents",         en: "Documents",     iconName: "FileText"        },
  { href: "/questionnaire", fr: "Questionnaire",     en: "Questionnaire", iconName: "HelpCircle"      },
  { href: "/resume",        fr: "Résumé fiscal",     en: "Tax summary",   iconName: "BarChart3"       },
];

export function AppNav({
  navItems = DEFAULT_INDIVIDUAL_NAV,
  workspaceLabel = { fr: "Espace personnel", en: "Personal workspace" },
  role = "INDIVIDUAL",
  homeHref = "/dashboard",
}: AppNavProps) {
  const { theme, toggleTheme, lang, toggleLang, t } = useApp();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const accentColor = WORKSPACE_COLORS[role] ?? "#2563EB";

  return (
    <>
      {/* ── Barre principale ─────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--nav-bg)",
        borderBottom: "1px solid var(--nav-border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 1px 0 var(--nav-border), 0 2px 8px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          padding: "0 16px", height: 56,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          {/* Logo + workspace badge */}
          <Link href={homeHref} style={{
            display: "flex", alignItems: "center",
            gap: 0, flexShrink: 0, textDecoration: "none",
          }}>
            <span className="et-logo-easy" style={{ fontSize: 21, fontWeight: 800, lineHeight: 1 }}>Easy</span>
            <span style={{ fontSize: 21, fontWeight: 800, lineHeight: 1, color: "var(--text-primary)" }}>Tax</span>
            {/* Workspace badge — couleur selon le rôle */}
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 700,
              padding: "2px 7px", borderRadius: 100,
              background: `${accentColor}18`,
              color: accentColor,
              letterSpacing: "0.04em",
            }}>
              {lang === "fr" ? workspaceLabel.fr : workspaceLabel.en}
            </span>
          </Link>

          {/* Nav desktop */}
          <div className="hide-mobile" style={{
            display: "flex", alignItems: "center",
            gap: 2, flex: 1, overflowX: "auto",
          }}>
            {navItems.map(({ href, iconName, fr, en }) => {
              const Icon = ICON_MAP[iconName];
              const active = isActive(href);
              return (
                <Link key={href} href={href} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 8,
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  color: active ? accentColor : "var(--text-secondary)",
                  background: active ? `${accentColor}10` : "transparent",
                  textDecoration: "none", whiteSpace: "nowrap",
                  transition: "all 120ms",
                }}>
                  {Icon && <Icon size={14} strokeWidth={1.8} />}
                  {lang === "fr" ? fr : en}
                </Link>
              );
            })}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {/* Lang */}
            <button onClick={toggleLang}
              title={lang === "fr" ? "English" : "Français"}
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
              <Globe size={15} strokeWidth={1.8} />
            </button>

            {/* Theme */}
            <button onClick={toggleTheme}
              style={{
                width: 34, height: 34, borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
              {theme === "light"
                ? <Moon size={15} strokeWidth={1.8} />
                : <Sun  size={15} strokeWidth={1.8} />}
            </button>

            {/* Clerk avatar */}
            <div style={{ marginLeft: 2 }}>
              <UserButton />
            </div>

            {/* Hamburger mobile */}
            <button
              onClick={() => setOpen(true)}
              className="show-mobile"
              aria-label={t("Ouvrir le menu", "Open menu")}
              style={{
                width: 38, height: 38, borderRadius: 10,
                border: `1.5px solid ${accentColor}40`,
                background: `${accentColor}0D`,
                color: accentColor,
                cursor: "pointer", display: "none",
                alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginLeft: 4,
                transition: "all 150ms",
              }}>
              <Menu size={19} strokeWidth={2} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Overlay ──────────────────────────────────────── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 40, backdropFilter: "blur(3px)",
          }}
        />
      )}

      {/* ── Drawer mobile ────────────────────────────────── */}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(300px, 82vw)",
        background: "var(--bg-sidebar)",
        borderLeft: "1px solid var(--border)",
        zIndex: 41,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 280ms cubic-bezier(0.4,0,0.2,1)",
        display: "flex", flexDirection: "column",
        boxShadow: open ? "-8px 0 32px rgba(0,0,0,0.15)" : "none",
      }}>
        {/* Header drawer */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span className="et-logo-easy" style={{ fontSize: 19, fontWeight: 800 }}>Easy</span>
              <span style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)" }}>Tax</span>
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, marginTop: 2,
              color: accentColor, letterSpacing: "0.04em",
            }}>
              {lang === "fr" ? workspaceLabel.fr.toUpperCase() : workspaceLabel.en.toUpperCase()}
            </div>
          </div>
          <button onClick={() => setOpen(false)}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-card-hover)",
              color: "var(--text-secondary)",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
            <X size={15} />
          </button>
        </div>

        {/* Links */}
        <nav style={{ padding: "12px 10px", flex: 1, overflowY: "auto" }}>
          <p style={{
            fontSize: 10, fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "4px 12px 10px",
          }}>
            {t("Navigation", "Navigation")}
          </p>

          {navItems.map(({ href, iconName, fr, en }) => {
            const Icon = ICON_MAP[iconName];
            const active = isActive(href);
            return (
              <Link key={href} href={href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px", borderRadius: 12,
                  marginBottom: 2, textDecoration: "none",
                  background: active ? `${accentColor}0E` : "transparent",
                  color: active ? accentColor : "var(--text-secondary)",
                  fontWeight: active ? 600 : 400,
                  transition: "all 120ms",
                }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {Icon && <Icon size={17} strokeWidth={1.8} />}
                  <span style={{ fontSize: 14 }}>{lang === "fr" ? fr : en}</span>
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
          <button onClick={toggleLang} style={{
            flex: 1, height: 38, borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
            fontSize: 13, fontWeight: 500,
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Globe size={14} />
            {lang === "fr" ? "English" : "Français"}
          </button>
          <button onClick={toggleTheme} style={{
            flex: 1, height: 38, borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-secondary)",
            fontSize: 13, fontWeight: 500,
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {theme === "light"
              ? <><Moon size={14} />{t("Sombre", "Dark")}</>
              : <><Sun  size={14} />{t("Clair",  "Light")}</>}
          </button>
        </div>
      </aside>

      {/* CSS show/hide mobile */}
      <style>{`
        @media (max-width: 1023px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
        @media (min-width: 1024px) {
          .show-mobile { display: none !important; }
        }
        .et-nav-link:hover {
          color: var(--text-primary) !important;
          background: var(--bg-card-hover) !important;
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
        background: "var(--nav-bg)",
        borderBottom: "1px solid var(--nav-border)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "0 16px",
          height: 56, display: "flex",
          alignItems: "center", justifyContent: "space-between",
        }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <span className="et-logo-easy" style={{ fontSize: 21, fontWeight: 800 }}>Easy</span>
            <span style={{ fontSize: 21, fontWeight: 800, color: "var(--text-primary)" }}>Tax</span>
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 700,
              padding: "2px 7px", borderRadius: 100,
              background: "rgba(229,52,42,0.1)", color: "var(--et-red)",
            }}>CA</span>
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={toggleLang} style={{
              width: 34, height: 34, borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-card)", color: "var(--text-secondary)",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <Globe size={15} />
            </button>
            <button onClick={toggleTheme} style={{
              width: 34, height: 34, borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-card)", color: "var(--text-secondary)",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <Link href="/sign-in" style={{
              padding: "7px 14px", borderRadius: 8, fontSize: 13,
              fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none",
            }}>{t("Connexion", "Sign in")}</Link>
            <Link href="/sign-up" className="et-btn et-btn-primary" style={{ fontSize: 13 }}>
              {t("Commencer", "Get started")}
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}
