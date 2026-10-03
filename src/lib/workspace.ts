/**
 * workspace.ts — Contexte workspace par rôle
 * Toujours appelé côté SERVEUR uniquement.
 */

export type UserRole = "INDIVIDUAL" | "PREPARER" | "BUSINESS" | "ADMIN" | "SUPER_ADMIN";

export interface NavItem {
  href: string;
  fr: string;
  en: string;
  iconName: string;
}

export interface WorkspaceConfig {
  role: UserRole;
  workspaceLabel: { fr: string; en: string };
  homeHref: string;
  navItems: NavItem[];
}

// ─── MENU INDIVIDUAL ─────────────────────────────────────────────────────────

const INDIVIDUAL_NAV: NavItem[] = [
  { href: "/dashboard",     fr: "Tableau de bord",  en: "Dashboard",      iconName: "LayoutDashboard" },
  { href: "/dossier",       fr: "Mon dossier",       en: "My file",        iconName: "FolderOpen"      },
  { href: "/documents",     fr: "Documents",         en: "Documents",      iconName: "FileText"        },
  { href: "/questionnaire", fr: "Questionnaire",     en: "Questionnaire",  iconName: "HelpCircle"      },
  { href: "/resume",        fr: "Résumé fiscal",     en: "Tax summary",    iconName: "BarChart3"       },
  { href: "/declarations",  fr: "Déclarations",      en: "Returns",        iconName: "ClipboardList"   },
  { href: "/profil",        fr: "Mon profil",        en: "My profile",     iconName: "Settings"        },
];

// ─── MENU BUSINESS ───────────────────────────────────────────────────────────

const BUSINESS_NAV: NavItem[] = [
  { href: "/business",              fr: "Tableau de bord",   en: "Dashboard",         iconName: "LayoutDashboard" },
  { href: "/business/company",      fr: "Mon entreprise",    en: "My company",        iconName: "Building2"       },
  { href: "/business/employees",    fr: "Employés",          en: "Employees",         iconName: "Users"           },
  { href: "/business/documents",    fr: "Documents",         en: "Documents",         iconName: "FileText"        },
  { href: "/business/taxes",        fr: "Taxes",             en: "Taxes",             iconName: "Receipt"         },
  { href: "/business/calculations", fr: "Calculs fiscaux",   en: "Tax calculations",  iconName: "Calculator"      },
  { href: "/business/settings",     fr: "Paramètres",        en: "Settings",          iconName: "Settings"        },
];

// ─── MENU PREPARER ───────────────────────────────────────────────────────────

const PREPARER_NAV: NavItem[] = [
  { href: "/preparer",              fr: "Tableau de bord",   en: "Dashboard",      iconName: "LayoutDashboard" },
  { href: "/preparer/clients",      fr: "Mes clients",       en: "My clients",     iconName: "UsersRound"      },
  { href: "/preparer/dossiers",     fr: "Dossiers clients",  en: "Client files",   iconName: "BookOpen"        },
  { href: "/preparer/documents",    fr: "Documents",         en: "Documents",      iconName: "FileText"        },
  { href: "/preparer/calculations", fr: "Calculs",           en: "Calculations",   iconName: "Calculator"      },
  { href: "/preparer/reviews",      fr: "Révisions",         en: "Reviews",        iconName: "UserCheck"       },
  { href: "/preparer/settings",     fr: "Paramètres",        en: "Settings",       iconName: "Settings"        },
];

// ─── MENU ADMIN — vue plateforme complète ────────────────────────────────────
// L'admin surveille et gère la plateforme. Jamais de questionnaire personnel.

const ADMIN_NAV: NavItem[] = [
  { href: "/admin",                  fr: "Console admin",       en: "Admin console",    iconName: "ShieldCheck"  },
  // ── Comptes ──
  { href: "/admin/users",            fr: "Utilisateurs",        en: "Users",            iconName: "Users"        },
  { href: "/admin/users/individual", fr: "Comptes individuels", en: "Individual accts", iconName: "UserCheck"    },
  { href: "/admin/users/business",   fr: "Comptes entreprises", en: "Business accts",   iconName: "Building2"    },
  { href: "/admin/users/preparers",  fr: "Préparateurs",        en: "Preparers",        iconName: "UsersRound"   },
  // ── Activité ──
  { href: "/admin/declarations",     fr: "Déclarations",        en: "Tax returns",      iconName: "ScrollText"   },
  { href: "/admin/documents",        fr: "Documents",           en: "Documents",        iconName: "FileText"     },
  { href: "/admin/organizations",    fr: "Organisations",       en: "Organizations",    iconName: "Landmark"     },
  // ── Système fiscal ──
  { href: "/admin/tax-rules",        fr: "Règles fiscales",     en: "Tax rules",        iconName: "Calculator"   },
  { href: "/admin/notifications",    fr: "Notifications",       en: "Notifications",    iconName: "Bell"         },
  // ── Administration ──
  { href: "/admin/audit",            fr: "Journal d'audit",     en: "Audit log",        iconName: "ClipboardList"},
  { href: "/admin/settings",         fr: "Paramètres système",  en: "System settings",  iconName: "Settings"     },
];

// ─── MAP RÔLE → CONFIG ────────────────────────────────────────────────────────

export function getWorkspaceConfig(role: UserRole): WorkspaceConfig {
  switch (role) {
    case "INDIVIDUAL":
      return {
        role,
        workspaceLabel: { fr: "Espace personnel", en: "Personal workspace" },
        homeHref: "/dashboard",
        navItems: INDIVIDUAL_NAV,
      };

    case "BUSINESS":
      return {
        role,
        workspaceLabel: { fr: "Espace entreprise", en: "Business workspace" },
        homeHref: "/business",
        navItems: BUSINESS_NAV,
      };

    case "PREPARER":
      return {
        role,
        workspaceLabel: { fr: "Espace préparateur", en: "Preparer workspace" },
        homeHref: "/preparer",
        navItems: PREPARER_NAV,
      };

    case "ADMIN":
    case "SUPER_ADMIN":
      return {
        role,
        workspaceLabel: { fr: "Console admin", en: "Admin console" },
        homeHref: "/admin",
        navItems: ADMIN_NAV,
      };
  }
}

// ─── ROUTES AUTORISÉES PAR RÔLE ───────────────────────────────────────────────

export const ROLE_ROUTE_MAP: Record<string, UserRole[]> = {
  // Workspace individual uniquement
  "/dashboard":     ["INDIVIDUAL", "PREPARER", "BUSINESS", "ADMIN", "SUPER_ADMIN"],
  "/dossier":       ["INDIVIDUAL"],
  "/documents":     ["INDIVIDUAL"],
  "/questionnaire": ["INDIVIDUAL"],    // ← JAMAIS ADMIN
  "/resume":        ["INDIVIDUAL"],
  "/declarations":  ["INDIVIDUAL"],

  // Workspace business
  "/business":      ["BUSINESS", "ADMIN", "SUPER_ADMIN"],

  // Workspace préparateur
  "/preparer":      ["PREPARER", "ADMIN", "SUPER_ADMIN"],

  // Console admin uniquement
  "/admin":         ["ADMIN", "SUPER_ADMIN"],
};

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const matchingRules = Object.entries(ROLE_ROUTE_MAP)
    .filter(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"))
    .sort((a, b) => b[0].length - a[0].length);

  if (matchingRules.length === 0) return true;
  const [, allowedRoles] = matchingRules[0];
  return allowedRoles.includes(role);
}
