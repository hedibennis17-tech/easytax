// ═══════════════════════════════════════════════════════════════
// QUESTION ENGINE — Logique de questionnaire dynamique
// Ne pose que les questions pertinentes selon le contexte
// ═══════════════════════════════════════════════════════════════

export interface QuestionContext {
  // Ce qu'on sait déjà des documents validés + réponses
  hasValidatedT4: boolean;
  numValidatedT4s: number;
  validatedT4Employers: string[];
  answers: Record<string, string | boolean | null>;
  province: string;
}

export interface QuestionDecision {
  shouldAsk: boolean;
  reason: string;
  prefilledValue?: string | boolean;
}

// Décide si une question doit être posée compte tenu du contexte
export function shouldAskQuestion(
  questionCode: string,
  ctx: QuestionContext
): QuestionDecision {
  switch (questionCode) {
    // ── EMPLOI ──────────────────────────────────────────────────
    case "has_employment_income":
      if (ctx.hasValidatedT4) {
        return {
          shouldAsk: false,
          reason: "T4 validé détecté",
          prefilledValue: true,
        };
      }
      return { shouldAsk: true, reason: "Aucun T4 détecté" };

    case "has_additional_employers":
      if (!ctx.hasValidatedT4) {
        return { shouldAsk: false, reason: "Aucun T4 — non applicable" };
      }
      if (ctx.numValidatedT4s > 1) {
        return {
          shouldAsk: false,
          reason: `${ctx.numValidatedT4s} T4 détectés`,
          prefilledValue: true,
        };
      }
      return { shouldAsk: true, reason: "Un seul T4 — vérifier si autres employeurs" };

    case "employer_names":
      // Ne demander que si pas déjà extrait du T4
      if (ctx.validatedT4Employers.length > 0) {
        return {
          shouldAsk: false,
          reason: "Employeurs extraits du T4",
          prefilledValue: ctx.validatedT4Employers.join(", "),
        };
      }
      return { shouldAsk: true, reason: "Noms d'employeurs non connus" };

    // ── TRAVAIL AUTONOME ─────────────────────────────────────────
    case "has_self_employment":
      return { shouldAsk: true, reason: "Toujours vérifier" };

    case "self_employment_vehicle":
    case "self_employment_home_office":
    case "self_employment_expenses":
      if (!ctx.answers["has_self_employment"]) {
        return { shouldAsk: false, reason: "Pas de travail autonome" };
      }
      return { shouldAsk: true, reason: "Travail autonome confirmé" };

    // ── INVESTISSEMENT ───────────────────────────────────────────
    case "has_investment_income":
      return { shouldAsk: true, reason: "À vérifier" };

    case "investment_interest":
    case "investment_dividends":
    case "investment_capital_gains":
      if (!ctx.answers["has_investment_income"]) {
        return { shouldAsk: false, reason: "Pas de revenus d'investissement" };
      }
      return { shouldAsk: true, reason: "Investissements confirmés" };

    // ── LOCATION ────────────────────────────────────────────────
    case "has_rental_income":
      return { shouldAsk: true, reason: "À vérifier" };

    case "rental_income_amount":
    case "rental_expenses":
      if (!ctx.answers["has_rental_income"]) {
        return { shouldAsk: false, reason: "Pas de revenus de location" };
      }
      return { shouldAsk: true, reason: "Location confirmée" };

    // ── RRSP ─────────────────────────────────────────────────────
    case "has_rrsp_contribution":
      return { shouldAsk: true, reason: "Déduction courante" };

    case "rrsp_amount":
      if (!ctx.answers["has_rrsp_contribution"]) {
        return { shouldAsk: false, reason: "Pas de REER déclaré" };
      }
      return { shouldAsk: true, reason: "REER confirmé" };

    // ── DÉPENSES D'EMPLOI ────────────────────────────────────────
    case "worked_from_home":
      if (!ctx.answers["has_employment_income"] && !ctx.hasValidatedT4) {
        return { shouldAsk: false, reason: "Pas d'emploi" };
      }
      return { shouldAsk: true, reason: "Emploi confirmé" };

    case "employment_expenses_t2200":
      if (!ctx.answers["worked_from_home"]) {
        return { shouldAsk: false, reason: "Pas de travail à domicile" };
      }
      return { shouldAsk: true, reason: "Télétravail confirmé" };

    // ── SITUATION FAMILIALE ──────────────────────────────────────
    case "has_dependents":
      return { shouldAsk: true, reason: "Impact sur crédits" };

    case "childcare_expenses":
      if (!ctx.answers["has_dependents"]) {
        return { shouldAsk: false, reason: "Pas de personnes à charge" };
      }
      return { shouldAsk: true, reason: "Personnes à charge déclarées" };

    // ── DÉMÉNAGEMENT ─────────────────────────────────────────────
    case "changed_province":
      return { shouldAsk: true, reason: "Peut affecter la juridiction" };

    case "moved_for_work":
      if (!ctx.answers["changed_province"]) {
        return { shouldAsk: false, reason: "Pas de déménagement" };
      }
      return { shouldAsk: true, reason: "Déménagement déclaré" };

    // ── QUÉBEC SPÉCIFIQUE ────────────────────────────────────────
    case "has_qpip_premiums":
    case "has_qpip_benefits":
      if (ctx.province !== "QC") {
        return { shouldAsk: false, reason: "Hors Québec" };
      }
      return { shouldAsk: true, reason: "Résident Québec" };

    // Par défaut — poser la question
    default:
      return { shouldAsk: true, reason: "Question générale" };
  }
}

// Calcule les prochaines sections à afficher selon le contexte
export function getActiveSections(ctx: QuestionContext): string[] {
  const sections: string[] = ["identity", "family"];

  // Emploi — toujours si T4 ou déclaré
  if (ctx.hasValidatedT4 || ctx.answers["has_employment_income"]) {
    sections.push("employment");
  } else {
    sections.push("employment"); // On demande quand même au minimum
  }

  // Travail autonome
  if (ctx.answers["has_self_employment"]) {
    sections.push("self_employment");
  }

  // Investissements
  if (ctx.answers["has_investment_income"]) {
    sections.push("investment");
  }

  // Déductions
  sections.push("deductions");

  // Crédits
  sections.push("credits");

  // Provincial
  sections.push("provincial");

  // Révision
  sections.push("review");

  return sections;
}

// Retourne un résumé du contexte pour debug/affichage
export function summarizeContext(ctx: QuestionContext): string[] {
  const facts: string[] = [];
  if (ctx.hasValidatedT4) {
    facts.push(`${ctx.numValidatedT4s} T4 validé(s): ${ctx.validatedT4Employers.join(", ")}`);
  }
  if (ctx.answers["has_self_employment"]) facts.push("Travail autonome déclaré");
  if (ctx.answers["has_investment_income"]) facts.push("Revenus d'investissement déclarés");
  if (ctx.answers["has_rental_income"]) facts.push("Revenus de location déclarés");
  if (ctx.answers["has_rrsp_contribution"]) facts.push("Cotisation REER déclarée");
  if (ctx.answers["worked_from_home"]) facts.push("Télétravail déclaré");
  return facts;
}
