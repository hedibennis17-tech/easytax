/**
 * draft.ts — Module brouillon questionnaire
 * Sauvegarde locale (localStorage) + DB pour reprendre sans repartir de zéro
 * Permet aussi de dupliquer une déclaration pour éditer après validation
 */

export interface DraftState {
  version: number;            // pour migrations futures
  taxYear: string;            // "2025"
  userId: string;
  answers: Record<string, unknown>;
  sectionIdx: number;
  questionIdx: number;
  triageDone: boolean;
  lastSavedAt: string;        // ISO date
  status: "in_progress" | "completed" | "archived";
}

const DRAFT_KEY_PREFIX = "easytax_draft_";

// ── Sauvegarder en localStorage ────────────────────────────────────────────
export function saveDraftLocal(userId: string, taxYear: string, state: Partial<DraftState>): void {
  try {
    const key = `${DRAFT_KEY_PREFIX}${userId}_${taxYear}`;
    const existing = loadDraftLocal(userId, taxYear) ?? {
      version: 2, taxYear, userId, answers: {}, sectionIdx: 0, questionIdx: 0,
      triageDone: false, lastSavedAt: new Date().toISOString(), status: "in_progress" as const,
    };
    const merged: DraftState = { ...existing, ...state, lastSavedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(merged));
  } catch { /* silencieux — localStorage peut être bloqué */ }
}

// ── Charger depuis localStorage ────────────────────────────────────────────
export function loadDraftLocal(userId: string, taxYear: string): DraftState | null {
  try {
    const key = `${DRAFT_KEY_PREFIX}${userId}_${taxYear}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as DraftState;
    // v2 = nouveau workflow 8 étapes. Invalider les anciens brouillons.
    if (!draft.version || draft.version < 2) {
      localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch { return null; }
}

// ── Supprimer le brouillon local ───────────────────────────────────────────
export function clearDraftLocal(userId: string, taxYear: string): void {
  try {
    localStorage.removeItem(`${DRAFT_KEY_PREFIX}${userId}_${taxYear}`);
  } catch { /* silencieux */ }
}

// ── Lister tous les brouillons locaux ─────────────────────────────────────
export function listDraftsLocal(userId: string): DraftState[] {
  try {
    const results: DraftState[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`${DRAFT_KEY_PREFIX}${userId}_`)) {
        const raw = localStorage.getItem(key);
        if (raw) results.push(JSON.parse(raw) as DraftState);
      }
    }
    return results.sort((a, b) => b.lastSavedAt.localeCompare(a.lastSavedAt));
  } catch { return []; }
}

// ── Dupliquer une déclaration pour édition ─────────────────────────────────
export function duplicateDraft(
  userId: string,
  sourceTaxYear: string,
  targetTaxYear: string
): DraftState | null {
  const source = loadDraftLocal(userId, sourceTaxYear);
  if (!source) return null;
  const copy: DraftState = {
    ...source,
    taxYear: targetTaxYear,
    sectionIdx: 0,
    questionIdx: 0,
    triageDone: source.triageDone, // garder triage si déjà fait
    lastSavedAt: new Date().toISOString(),
    status: "in_progress",
  };
  saveDraftLocal(userId, targetTaxYear, copy);
  return copy;
}

// ── Formatter la date de sauvegarde ───────────────────────────────────────
export function formatLastSaved(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    return d.toLocaleDateString("fr-CA");
  } catch { return "—"; }
}
