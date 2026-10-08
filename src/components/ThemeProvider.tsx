"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type Lang  = "fr" | "en";

interface AppContextValue {
  theme: Theme;
  toggleTheme: () => void;
  lang: Lang;
  toggleLang: () => void;
  t: (fr: string, en: string) => string;
}

const AppContext = createContext<AppContextValue>({
  theme: "light",
  toggleTheme: () => {},
  lang: "fr",
  toggleLang: () => {},
  t: (fr) => fr,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [lang, setLang]   = useState<Lang>("fr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("et-theme") as Theme | null;
    const savedLang  = localStorage.getItem("et-lang")  as Lang  | null;
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const t = savedTheme ?? (sysDark ? "dark" : "light");
    const l = savedLang ?? "fr";

    document.documentElement.setAttribute("data-theme", t);
    setTimeout(() => {
      setMounted(true);
      setTheme(t);
      setLang(l);
    }, 0);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("et-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const toggleLang = () => {
    const next = lang === "fr" ? "en" : "fr";
    setLang(next);
    localStorage.setItem("et-lang", next);
  };

  const t = (fr: string, en: string) => lang === "fr" ? fr : en;

  if (!mounted) return <>{children}</>;

  return (
    <AppContext.Provider value={{ theme, toggleTheme, lang, toggleLang, t }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
