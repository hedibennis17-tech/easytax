"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { useApp } from "./ThemeProvider";
import {
  LayoutDashboard, FileText, FolderOpen, HelpCircle, BarChart3,
  Building2, Users, ShieldCheck, Sun, Moon, Menu, X, Globe,
  ChevronRight, ClipboardList,
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    fr: "Tableau de bord",
    en: "Dashboard",
  },
  {
    href: "/documents",
    icon: FileText,
    fr: "Documents",
    en: "Documents",
  },
  {
    href: "/dossier",
    icon: FolderOpen,
    fr: "Mon dossier",
    en: "My file",
  },
  {
    href: "/questionnaire",
    icon: HelpCircle,
    fr: "Questionnaire",
    en: "Questionnaire",
  },
  {
    href: "/resume",
    icon: BarChart3,
    fr: "Résumé fiscal",
    en: "Tax summary",
  },
  {
    href: "/business",
    icon: Building2,
    fr: "Business",
    en: "Business",
  },
  {
    href: "/preparer",
    icon: Users,
    fr: "Préparateur",
    en: "Preparer",
  },
  {
    href: "/admin",
    icon: ShieldCheck,
    fr: "Admin",
    en: "Admin",
  },
] as const;

export function AppNav() {
  const { theme, toggleTheme, lang, toggleLang, t } = useApp();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* ── Navbar principale ──────────────────────────────── */}
      <nav className="et-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-0.5 shrink-0"
            aria-label="EasyTax"
          >
            <span className="text-[22px] font-bold et-logo-easy leading-none">Easy</span>
            <span
              className="text-[22px] font-bold leading-none"
              style={{ color: "var(--text-primary)" }}
            >
              Tax
            </span>
            <span
              className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded et-badge et-badge-red hidden sm:inline-flex"
            >
              CA
            </span>
          </Link>

          {/* Nav links — desktop uniquement */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 overflow-x-auto">
            {NAV_ITEMS.map(({ href, icon: Icon, fr, en }) => (
              <Link
                key={href}
                href={href}
                className={`et-nav-link${isActive(href) ? " active" : ""}`}
              >
                <Icon size={15} strokeWidth={1.8} aria-hidden />
                <span>{t(fr, en)}</span>
              </Link>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Lang toggle */}
            <button
              onClick={toggleLang}
              className="et-btn et-btn-ghost h-8 w-8 p-0 rounded-lg"
              title={lang === "fr" ? "Switch to English" : "Passer en français"}
              aria-label="Toggle language"
            >
              <Globe size={15} strokeWidth={1.8} />
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="et-btn et-btn-ghost h-8 w-8 p-0 rounded-lg"
              title={theme === "light" ? t("Mode sombre", "Dark mode") : t("Mode clair", "Light mode")}
              aria-label="Toggle theme"
            >
              {theme === "light"
                ? <Moon size={15} strokeWidth={1.8} />
                : <Sun  size={15} strokeWidth={1.8} />
              }
            </button>

            {/* Clerk UserButton */}
            <div className="ml-1">
              <UserButton />
            </div>

            {/* Hamburger — mobile / tablet */}
            <button
              onClick={() => setMobileOpen(true)}
              className="et-btn et-btn-ghost h-8 w-8 p-0 rounded-lg lg:hidden ml-1"
              aria-label={t("Ouvrir le menu", "Open menu")}
            >
              <Menu size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile overlay ─────────────────────────────────── */}
      <div
        className={`et-sidebar-overlay${mobileOpen ? " open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden
      />

      {/* ── Mobile menu drawer ─────────────────────────────── */}
      <aside
        className={`et-mobile-menu${mobileOpen ? " open" : ""}`}
        role="dialog"
        aria-label={t("Menu de navigation", "Navigation menu")}
      >
        {/* Header du drawer */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-0.5">
            <span className="text-xl font-bold et-logo-easy">Easy</span>
            <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Tax</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="et-btn et-btn-ghost h-8 w-8 p-0 rounded-lg"
            aria-label={t("Fermer le menu", "Close menu")}
          >
            <X size={16} />
          </button>
        </div>

        {/* Links */}
        <nav className="px-3 py-4 space-y-0.5">
          <p className="et-section-title px-3 mb-3">{t("Navigation", "Navigation")}</p>
          {NAV_ITEMS.map(({ href, icon: Icon, fr, en }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all${
                isActive(href)
                  ? " font-semibold"
                  : ""
              }`}
              style={{
                color: isActive(href) ? "var(--et-red)" : "var(--text-secondary)",
                background: isActive(href) ? "rgba(229,52,42,0.08)" : "transparent",
              }}
            >
              <span className="flex items-center gap-3">
                <Icon size={17} strokeWidth={1.8} aria-hidden />
                <span className="text-[14px]">{t(fr, en)}</span>
              </span>
              <ChevronRight size={14} style={{ opacity: 0.4 }} />
            </Link>
          ))}
        </nav>

        {/* Footer drawer */}
        <div
          className="absolute bottom-0 left-0 right-0 border-t px-5 py-4 flex items-center justify-between"
          style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}
        >
          <button
            onClick={() => { toggleLang(); }}
            className="et-btn et-btn-ghost text-xs gap-1.5 px-3 py-2 rounded-lg"
          >
            <Globe size={14} />
            {lang === "fr" ? "English" : "Français"}
          </button>
          <button
            onClick={() => { toggleTheme(); }}
            className="et-btn et-btn-ghost text-xs gap-1.5 px-3 py-2 rounded-lg"
          >
            {theme === "light"
              ? <><Moon size={14} /> {t("Sombre", "Dark")}</>
              : <><Sun  size={14} /> {t("Clair", "Light")}</>
            }
          </button>
        </div>
      </aside>
    </>
  );
}

/* ── Nav légère pour pages publiques ─────────────────────── */
export function PublicNav() {
  const { theme, toggleTheme, lang, toggleLang, t } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="et-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-0.5 shrink-0">
            <span className="text-[22px] font-bold et-logo-easy leading-none">Easy</span>
            <span className="text-[22px] font-bold leading-none" style={{ color: "var(--text-primary)" }}>Tax</span>
            <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded et-badge et-badge-red hidden sm:inline-flex">CA</span>
          </Link>

          <div className="hidden sm:flex items-center gap-1">
            <button onClick={toggleLang} className="et-btn et-btn-ghost h-8 w-8 p-0 rounded-lg" aria-label="Toggle language">
              <Globe size={15} strokeWidth={1.8} />
            </button>
            <button onClick={toggleTheme} className="et-btn et-btn-ghost h-8 w-8 p-0 rounded-lg" aria-label="Toggle theme">
              {theme === "light" ? <Moon size={15} strokeWidth={1.8} /> : <Sun size={15} strokeWidth={1.8} />}
            </button>
            <Link href="/sign-in"  className="et-btn et-btn-ghost text-sm px-3 py-1.5">{t("Connexion", "Sign in")}</Link>
            <Link href="/sign-up"  className="et-btn et-btn-primary text-sm">{t("Commencer", "Get started")}</Link>
          </div>

          <button onClick={() => setMobileOpen(true)} className="et-btn et-btn-ghost h-8 w-8 p-0 rounded-lg sm:hidden" aria-label="Menu">
            <Menu size={18} />
          </button>
        </div>
      </nav>

      <div className={`et-sidebar-overlay${mobileOpen ? " open" : ""}`} onClick={() => setMobileOpen(false)} aria-hidden />
      <aside className={`et-mobile-menu${mobileOpen ? " open" : ""}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-0.5">
            <span className="text-xl font-bold et-logo-easy">Easy</span>
            <span className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Tax</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="et-btn et-btn-ghost h-8 w-8 p-0 rounded-lg"><X size={16} /></button>
        </div>
        <nav className="px-3 py-4 space-y-1">
          {[
            { href: "/sign-in",  label: t("Connexion", "Sign in") },
            { href: "/sign-up",  label: t("Créer un compte", "Create account") },
          ].map(({ href, label }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between px-3 py-3 rounded-xl"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="text-sm font-medium">{label}</span>
              <ChevronRight size={14} style={{ opacity: 0.4 }} />
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t px-5 py-4 flex gap-2" style={{ borderColor: "var(--border)", background: "var(--bg-sidebar)" }}>
          <button onClick={toggleLang} className="et-btn et-btn-ghost text-xs gap-1.5 px-3 py-2 rounded-lg flex-1">
            <Globe size={14} />{lang === "fr" ? "English" : "Français"}
          </button>
          <button onClick={toggleTheme} className="et-btn et-btn-ghost text-xs gap-1.5 px-3 py-2 rounded-lg flex-1">
            {theme === "light" ? <><Moon size={14}/>{t("Sombre","Dark")}</> : <><Sun size={14}/>{t("Clair","Light")}</>}
          </button>
        </div>
      </aside>
    </>
  );
}
