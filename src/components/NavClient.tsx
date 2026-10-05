"use client";

/**
 * NavClient — pour les pages "use client" uniquement
 * Fetch le rôle via /api/user/me et affiche la bonne nav
 */
import { useEffect, useState } from "react";
import { AppNav } from "./AppNav";
import { getWorkspaceConfig, type UserRole } from "@/lib/workspace";
import type { NavItem } from "@/lib/workspace";

const DEFAULT_NAV: NavItem[] = [
  { href: "/dashboard",     fr: "Tableau de bord",  en: "Dashboard",     iconName: "LayoutDashboard" },
  { href: "/dossier",       fr: "Mon dossier",       en: "My file",       iconName: "FolderOpen"      },
  { href: "/documents",     fr: "Documents",         en: "Documents",     iconName: "FileText"        },
  { href: "/questionnaire", fr: "Questionnaire",     en: "Questionnaire", iconName: "HelpCircle"      },
  { href: "/resume",        fr: "Résumé fiscal",     en: "Tax summary",   iconName: "BarChart3"       },
  { href: "/declarations",  fr: "Déclarations",      en: "Returns",         iconName: "ClipboardList"   },
];

export function NavClient() {
  const [navItems, setNavItems] = useState<NavItem[]>(DEFAULT_NAV);
  const [role, setRole] = useState<UserRole>("INDIVIDUAL");
  const [workspaceLabel, setWorkspaceLabel] = useState({ fr: "Espace personnel", en: "Personal workspace" });
  const [homeHref, setHomeHref] = useState("/dashboard");

  useEffect(() => {
    fetch("/api/user/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.role) {
          const r = data.role as UserRole;
          const config = getWorkspaceConfig(r);
          setRole(r);
          setNavItems(config.navItems);
          setWorkspaceLabel(config.workspaceLabel);
          setHomeHref(config.homeHref);
        }
      })
      .catch(() => {/* garde le défaut */});
  }, []);

  return (
    <AppNav
      navItems={navItems}
      workspaceLabel={workspaceLabel}
      role={role}
      homeHref={homeHref}
    />
  );
}
