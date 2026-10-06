-- EasyTax questionnaire schema supplied by the user. Idempotent migration.
-- ═══════════════════════════════════════════════════════════════════════════
-- EasyTax — Schéma des questionnaires (particulier + entreprise), année 2025
-- Généré le 2026-10-06 depuis src/lib/questionnaire-individual.ts et
-- src/lib/questionnaire-business.ts (donnée source de /questionnaire).
--
-- CONVENTIONS (à respecter impérativement) :
--   1. Tous les montants sont stockés en CENTS (INTEGER), jamais en FLOAT.
--      Ex. : 7 212,90 $  →  721290. Même convention que income_entries,
--      deduction_entries et credit_entries (amount_cents).
--   2. Le nom de chaque colonne = l'ID de la question (t1, p3, on_01, br4…).
--      Traçabilité directe vers le code source du questionnaire.
--   3. Toutes les colonnes de réponse sont NULLABLE : la sauvegarde est
--      progressive (l'usager répond étape par étape). Le caractère obligatoire
--      (required) est appliqué au niveau applicatif, pas en base.
--   4. Chaque colonne porte un COMMENT avec le texte français de la question.
--   5. Les clés étrangères vers tax_profiles, tax_years, tax_returns et
--      fiscal_documents supposent le schéma EasyTax existant (même base).
--      Pour un usage hors EasyTax, retirez les clauses REFERENCES.
--
-- FLUX DE SYNCHRONISATION avec les entrées fiscales :
--   a) Réponse saisie  →  INSERT/UPDATE dans la table de l'étape + ligne
--      dans q_answer_history (audit).
--   b) Si la question figure dans q_entry_map avec un montant, créer/mettre
--      à jour une ligne dans q_entry_sync (statut 'en_attente').
--   c) À la validation de l'étape : créer l'entrée correspondante dans
--      income_entries / deduction_entries / credit_entries avec
--      source_type = 'questionnaire', is_validated = false, et renseigner
--      q_entry_sync.entry_id + statut 'synchronise'.
--   d) L'usager confirme chaque entrée dans l'UI → is_validated = true.
--      Le moteur fiscal n'utilise QUE les entrées validées.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
-- ─── Table maîtresse : une ligne par questionnaire rempli ───
CREATE TABLE IF NOT EXISTS q_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR(255) NOT NULL,
  tax_profile_id UUID REFERENCES tax_profiles(id),
  tax_year_id   UUID REFERENCES tax_years(id),
  tax_return_id UUID REFERENCES tax_returns(id),
  questionnaire_type VARCHAR(20) NOT NULL DEFAULT 'particulier'
      CHECK (questionnaire_type IN ('particulier','entreprise')),
  province      CHAR(2),
  status        VARCHAR(20) NOT NULL DEFAULT 'brouillon'
      CHECK (status IN ('brouillon','en_cours','complete','validee')),
  current_step  VARCHAR(50),
  progress_pct  SMALLINT CHECK (progress_pct BETWEEN 0 AND 100),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tax_return_id, questionnaire_type)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_q_sessions_user ON q_sessions(user_id);
--> statement-breakpoint
COMMENT ON TABLE q_sessions IS 'En-tête de chaque questionnaire rempli (particulier ou entreprise).';
--> statement-breakpoint
-- ─── q_triage — Étape 1 — Triage (6 questions Oui/Non, porte d'entrée du questionnaire) ───
CREATE TABLE IF NOT EXISTS q_triage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  t1 BOOLEAN,
  t2 BOOLEAN,
  t3 BOOLEAN,
  t4 BOOLEAN,
  t5 BOOLEAN,
  t6 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_triage IS 'Étape 1 — Triage (6 questions Oui/Non, porte d''entrée du questionnaire)';
--> statement-breakpoint
COMMENT ON COLUMN q_triage.t1 IS 'Avez-vous eu un revenu d''emploi (salarié) en 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_triage.t2 IS 'Avez-vous eu des revenus de travail autonome en 2025 ? (Uber, DoorDash, freelance, contrats...)';
--> statement-breakpoint
COMMENT ON COLUMN q_triage.t3 IS 'Avez-vous perçu des revenus de location en 2025 ? (immeuble, logement, stationnement...)';
--> statement-breakpoint
COMMENT ON COLUMN q_triage.t4 IS 'Avez-vous eu des revenus de placements en 2025 ? (intérêts, dividendes, gains en capital, cryptomonnaies)';
--> statement-breakpoint
COMMENT ON COLUMN q_triage.t5 IS 'Avez-vous touché d''autres revenus en 2025 ? (retraite, RPC/RRQ, assurance-emploi, bourses, revenus étrangers)';
--> statement-breakpoint
COMMENT ON COLUMN q_triage.t6 IS 'Avez-vous un époux/conjoint ou des personnes à charge (enfants...) ?';
--> statement-breakpoint
-- ─── q_profil — Étape 2 — Profil fiscal (identité, résidence, statut) ───
CREATE TABLE IF NOT EXISTS q_profil (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  p1 TEXT,
  p2 TEXT,
  p3 TEXT,
  p4 DATE,
  p5 JSONB,
  p6 JSONB,
  p7 TEXT,
  p8 TEXT,
  p9 VARCHAR(100) CHECK (p9 IN ('fr', 'en')),
  p10 VARCHAR(100) CHECK (p10 IN ('fr', 'en')),
  p11 VARCHAR(100) CHECK (p11 IN ('citizen', 'pr', 'work', 'study', 'refugee', 'other')),
  p12 BOOLEAN,
  p13 BOOLEAN,
  p14 VARCHAR(100) CHECK (p14 IN ('QC', 'ON', 'BC', 'AB', 'SK', 'MB', 'NB', 'NS', 'PE', 'NL', 'NT', 'NU', 'YT')),
  p15 BOOLEAN,
  p16 BOOLEAN,
  p17 BOOLEAN,
  p18 BOOLEAN,
  p19 BOOLEAN,
  p20 BOOLEAN,
  p21 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_profil IS 'Étape 2 — Profil fiscal (identité, résidence, statut)';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p1 IS 'Nom de famille';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p2 IS 'Prénom et initiales';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p3 IS 'Numéro d''assurance sociale (NAS, 9 chiffres) — Indice : Le NAS est chiffré et sécurisé — jamais partagé';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p4 IS 'Date de naissance';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p5 IS 'Adresse de résidence au 31 décembre 2025';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p6 IS 'Adresse postale si différente de l''adresse de résidence';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p7 IS 'Numéro de téléphone';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p8 IS 'Adresse courriel';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p9 IS 'Langue de correspondance souhaitée avec l''ARC';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p10 IS 'Langue de correspondance souhaitée avec Revenu Québec';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p11 IS 'Statut au Canada';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p12 IS 'Êtes-vous un Indien inscrit au sens de la Loi sur les Indiens ?';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p13 IS 'Si oui : l''employeur et le lieu de travail sont-ils situés sur une réserve ? [affiché si : p12=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p14 IS 'Dans quelle province ou territoire résidez-vous au 31 décembre 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p15 IS 'Est-ce votre première déclaration de revenus au Canada ?';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p16 IS 'Avez-vous déménagé dans une autre province ou un autre territoire en 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p17 IS 'Avez-vous immigré au Canada en 2025 ? — Indice : Si oui, précisez la date d''arrivée et le pays de provenance';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p18 IS 'Avez-vous émigré du Canada en 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p19 IS 'Étiez-vous non-résident du Canada pendant une partie de 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p20 IS 'Avez-vous été en faillite en 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_profil.p21 IS 'Cette déclaration est-elle produite pour une personne décédée en 2025 ?';
--> statement-breakpoint
-- ─── q_famille — Étape 3 — Famille (état civil, conjoint, personnes à charge) ───
CREATE TABLE IF NOT EXISTS q_famille (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  f1 VARCHAR(100) CHECK (f1 IN ('married', 'common_law', 'separated', 'divorced', 'widowed', 'single')),
  f2 DATE,
  f3_nom VARCHAR(200),
  f3_prenom VARCHAR(200),
  f3_nas VARCHAR(11),
  f3_naissance DATE,
  f3_revenu_net_cents INTEGER,
  f3_produit_declaration BOOLEAN,
  f4 BOOLEAN,
  f5 INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_famille IS 'Étape 3 — Famille (état civil, conjoint, personnes à charge)';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f1 IS 'Quelle était votre situation matrimoniale au 31 décembre 2025 ? [affiché si : t6=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f2 IS 'Si votre état civil a changé en 2025 : date du changement [affiché si : t6=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f3_nom IS 'Conjoint — nom de famille';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f3_prenom IS 'Conjoint — prénom';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f3_nas IS 'Conjoint — NAS (9 chiffres)';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f3_naissance IS 'Conjoint — date de naissance';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f3_revenu_net_cents IS 'Conjoint — revenu net 2025 (en cents)';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f3_produit_declaration IS 'Conjoint — produit-il/elle une déclaration ?';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f4 IS 'Avez-vous des personnes à charge ? [affiché si : t6=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_famille.f5 IS 'Combien de personnes à charge avez-vous ? [affiché si : f4=true]';
--> statement-breakpoint
-- ─── q_emploi — Étape 4 — Revenus d'emploi (condition : t1) ───
CREATE TABLE IF NOT EXISTS q_emploi (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  e1 INTEGER,
  e2 BOOLEAN,
  e3 INTEGER,
  e4 BOOLEAN,
  e5 BOOLEAN,
  e6 BOOLEAN,
  e7 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_emploi IS 'Étape 4 — Revenus d''emploi (condition : t1)';
--> statement-breakpoint
COMMENT ON COLUMN q_emploi.e1 IS 'Combien d''employeurs avez-vous eus en 2025 ? [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_emploi.e2 IS 'Avez-vous reçu un T4 de votre employeur ? [feuillet : T4] [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_emploi.e3 IS 'Avez-vous reçu des pourboires non indiqués sur vos feuillets T4 ? (montant) [montant en CENTS] [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_emploi.e4 IS 'Avez-vous gagné des commissions ? Sont-elles indiquées sur le T4 ? [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_emploi.e5 IS 'Avez-vous exercé des options d''achat d''actions de votre employeur en 2025 ? [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_emploi.e6 IS 'Avez-vous reçu des feuillets T4A (bourses, subventions, case 048, etc.) ? [feuillet : T4A] [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_emploi.e7 IS 'Votre employeur vous a-t-il signé un T2200 (dépenses d''emploi) ? [feuillet : T2200] [affiché si : t1=true]';
--> statement-breakpoint
-- ─── q_autonome — Étape 5 — Travail autonome (condition : t2) ───
CREATE TABLE IF NOT EXISTS q_autonome (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  a1 TEXT[],
  a2 TEXT,
  a3 DATE,
  a4 INTEGER,
  a5 VARCHAR(100) CHECK (a5 IN ('accrual', 'cash')),
  a6 BOOLEAN,
  a7 INTEGER,
  a8 INTEGER,
  a9 INTEGER,
  a10 INTEGER,
  a11 BOOLEAN,
  a12 INTEGER,
  a13 BOOLEAN,
  a14 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_autonome IS 'Étape 5 — Travail autonome (condition : t2)';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a1 IS 'Type d''activité autonome [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a2 IS 'Nom commercial et numéro d''entreprise (NEQ au Québec, ou NE de l''ARC) [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a3 IS 'Date de début de l''activité en 2025 [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a4 IS 'Revenus bruts de l''entreprise en 2025 — Indice : Avant déduction des dépenses d''entreprise [montant en CENTS] [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a5 IS 'Méthode comptable [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a6 IS 'Avez-vous des dépenses d''entreprise à déclarer ? [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a7 IS 'Dépenses d''entreprise 2025 — publicité [montant en CENTS] [affiché si : a6=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a8 IS 'Dépenses d''entreprise 2025 — assurances [montant en CENTS] [affiché si : a6=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a9 IS 'Dépenses d''entreprise 2025 — repas et représentation (50 % déductible) [montant en CENTS] [affiché si : a6=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a10 IS 'Inventaire de fin d''année (marchandises, travaux en cours) [montant en CENTS] [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a11 IS 'Utilisez-vous un véhicule pour l''entreprise ? [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a12 IS 'Kilomètres totaux parcourus en 2025 [affiché si : a11=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a13 IS 'Utilisez-vous une partie de votre domicile comme bureau d''affaires ? — Indice : Superficie du bureau / superficie totale du logement [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autonome.a14 IS 'Êtes-vous inscrit aux taxes (TPS/TVH/TVQ) ? — Indice : Obligatoire si revenus > 30 000 $ sur 4 trimestres consécutifs [affiché si : t2=true]';
--> statement-breakpoint
-- ─── q_location — Étape 6 — Revenus de location (condition : t3) ───
CREATE TABLE IF NOT EXISTS q_location (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  l1 TEXT,
  l2 INTEGER,
  l3 TEXT,
  l4 INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_location IS 'Étape 6 — Revenus de location (condition : t3)';
--> statement-breakpoint
COMMENT ON COLUMN q_location.l1 IS 'Pour chaque immeuble loué : adresse, nombre de logements, loyers bruts — Indice : Ajoutez autant de propriétés que nécessaire [affiché si : t3=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_location.l2 IS 'Revenus de location bruts totaux 2025 [montant en CENTS] [affiché si : t3=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_location.l3 IS 'Dépenses de location 2025 (assurances, intérêts hypothécaires, entretien, taxes, services publics) — Indice : Précisez le montant par catégorie de dépense [affiché si : t3=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_location.l4 IS 'Quote-part de copropriété (indivision ou société de personnes) [montant en CENTS] [affiché si : t3=true]';
--> statement-breakpoint
-- ─── q_placements — Étape 7 — Placements (condition : t4) ───
CREATE TABLE IF NOT EXISTS q_placements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  inv1 BOOLEAN,
  inv2 BOOLEAN,
  inv3 BOOLEAN,
  inv4 BOOLEAN,
  inv5 BOOLEAN,
  inv6 TEXT,
  inv7 BOOLEAN,
  inv8 BOOLEAN,
  inv9 BOOLEAN,
  inv10 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_placements IS 'Étape 7 — Placements (condition : t4)';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv1 IS 'Avez-vous un revenu de placement ? (T5, dividendes, etc.) [feuillet : T5] [affiché si : t4=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv2 IS 'Avez-vous gagné des intérêts ou dividendes de source étrangère ? — Indice : Précisez le pays, les montants et l''impôt étranger retenu [affiché si : t4=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv3 IS 'Avez-vous des biens étrangers dont le coût total dépasse 100 000 $ CA ? (T1135) [feuillet : T1135] [affiché si : t4=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv4 IS 'Avez-vous effectué des transactions en cryptomonnaies en 2025 ? — Indice : Achat, vente, échange — précisez les gains/pertes [affiché si : t4=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv5 IS 'Avez-vous vendu en 2025 des actions, obligations, fonds, immeubles ou autres immobilisations ? [affiché si : t4=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv6 IS 'Pour chaque disposition : description, dates, produit de disposition, prix de base rajusté, frais — Indice : Remplissez une ligne par bien vendu [affiché si : inv5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv7 IS 'Avez-vous vendu votre résidence principale en 2025 ? (T2091) [feuillet : T2091] [affiché si : t4=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv8 IS 'Déclarez-vous une provision pour gains en capital (solde de prix de vente à recevoir) ? [affiché si : t4=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv9 IS 'Avez-vous vendu des actions admissibles de petite entreprise ou biens agricoles/de pêche (ECGC, plafond 1 250 000 $) ? [affiché si : t4=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_placements.inv10 IS 'Avez-vous subi des pertes en capital en 2025 ou des pertes inutilisées d''années antérieures ? [affiché si : t4=true]';
--> statement-breakpoint
-- ─── q_autres_revenus — Étape 8 — Autres revenus (condition : t5) ───
CREATE TABLE IF NOT EXISTS q_autres_revenus (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  r1 INTEGER,
  r2 BOOLEAN,
  r3 BOOLEAN,
  r4 BOOLEAN,
  r5 INTEGER,
  r6 INTEGER,
  r7 BOOLEAN,
  r8 BOOLEAN,
  r9 BOOLEAN,
  r10 BOOLEAN,
  r11 BOOLEAN,
  r12 BOOLEAN,
  r13 BOOLEAN,
  r14 BOOLEAN,
  r15 BOOLEAN,
  r16 BOOLEAN,
  r17 INTEGER,
  r18 INTEGER,
  r19 INTEGER,
  r20 BOOLEAN,
  r21 INTEGER,
  r22 INTEGER,
  r23 TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_autres_revenus IS 'Étape 8 — Autres revenus (condition : t5)';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r1 IS 'Avez-vous reçu une allocation de retraite (indemnité de départ) ? Montant, transfert REER ? [montant en CENTS] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r2 IS 'Avez-vous gagné un revenu d''emploi à l''extérieur du Canada ? — Indice : Précisez le pays, le montant et l''impôt étranger retenu [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r3 IS 'Recevez-vous la pension de la Sécurité de la vieillesse (SV) ? [feuillet : T4A(OAS)] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r4 IS 'Recevez-vous une rente du RPC ou du RRQ ? [feuillet : T4A(P)] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r5 IS 'Avez-vous effectué des retraits d''un REER en 2025 ? [montant en CENTS] [feuillet : T4RSP] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r6 IS 'Avez-vous effectué des retraits d''un FERR en 2025 ? [montant en CENTS] [feuillet : T4RIF] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r7 IS 'Avez-vous effectué des retraits d''un CELIAPP ? S''agissait-il de retraits admissibles ? [feuillet : T4FHSA] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r8 IS 'Recevez-vous une pension d''un régime de retraite d''employeur ou une rente ? [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r9 IS 'Recevez-vous une pension d''un pays étranger ? — Indice : Précisez le pays, le montant brut et l''impôt retenu [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r10 IS 'Désirez-vous fractionner votre revenu de pension avec votre époux/conjoint (T1032) ? [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r11 IS 'Recevez-vous des prestations d''invalidité du RPC/RRQ ? [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r12 IS 'Recevez-vous le Supplément de revenu garanti (SRG) ou l''Allocation au survivant ? [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r13 IS 'Avez-vous reçu des prestations d''assurance-emploi en 2025 ? [feuillet : T4E] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r14 IS 'Avez-vous reçu de l''aide sociale ou des prestations provinciales ? [feuillet : T5007] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r15 IS 'Avez-vous reçu des indemnités d''accident du travail (ex. CNESST) ? [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r16 IS 'Avez-vous reçu des prestations d''invalidité (assurance salaire privée ou publique) ? [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r17 IS 'Avez-vous remboursé en 2025 des prestations reçues en trop (AE, SV, PCU/PCRE) ? [montant en CENTS] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r18 IS 'Recevez-vous une pension alimentaire ? — Indice : Montant et date de l''ordonnance (avant/après le 30 avril 1997) [montant en CENTS] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r19 IS 'Avez-vous reçu des bourses d''études ou subventions de recherche ? [montant en CENTS] [feuillet : T4A] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r20 IS 'Avez-vous reçu des paiements d''un REEI ? [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r21 IS 'Avez-vous reçu des jetons de présence d''administrateur ou honoraires de juré ? [montant en CENTS] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r22 IS 'Avez-vous reçu des ristournes, subventions ou paiements gouvernementaux imposables ? [montant en CENTS] [affiché si : t5=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_autres_revenus.r23 IS 'Autres revenus non énumérés ci-dessus (précisez et montant) [affiché si : t5=true]';
--> statement-breakpoint
-- ─── q_deductions — Étape 9 — Déductions ───
CREATE TABLE IF NOT EXISTS q_deductions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  d1 BOOLEAN,
  d2 INTEGER,
  d3 INTEGER,
  d4 INTEGER,
  d5 INTEGER,
  d6 INTEGER,
  d7 INTEGER,
  d8 INTEGER,
  d9 INTEGER,
  d10 BOOLEAN,
  d11 TEXT,
  d12 BOOLEAN,
  d13 INTEGER,
  d14 INTEGER,
  d15 BOOLEAN,
  d16 BOOLEAN,
  d17 BOOLEAN,
  d18 INTEGER,
  d19 BOOLEAN,
  d20 INTEGER,
  d21 BOOLEAN,
  d22 INTEGER,
  d23 INTEGER,
  d24 BOOLEAN,
  d25 INTEGER,
  d26 BOOLEAN,
  d27 TEXT,
  d28 BOOLEAN,
  d29 TEXT,
  d30 INTEGER,
  d31 BOOLEAN,
  d32 INTEGER,
  d33 BOOLEAN,
  d34 BOOLEAN,
  d35 INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_deductions IS 'Étape 9 — Déductions';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d1 IS 'Avez-vous cotisé à un REER cette année ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d2 IS 'Cotisations REER en 2025 et durant les 60 premiers jours de 2026 [montant en CENTS] [feuillet : RRSP_RECEIPT] [affiché si : d1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d3 IS 'Droits de cotisation inutilisés au REER (avis de cotisation 2024) [montant en CENTS] [affiché si : d1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d4 IS 'Avez-vous cotisé au REER de votre époux/conjoint en 2025 ? (montant) [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d5 IS 'Remboursement dans le cadre du RAP en 2025 (solde à rembourser) [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d6 IS 'Remboursement dans le cadre du REEP en 2025 (solde à rembourser) [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d7 IS 'Cotisations à un CELIAPP en 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d8 IS 'Cotisations à un RPA ou RPDB (montant au T4/RL-1) [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d9 IS 'Cotisations syndicales ou professionnelles payées en 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d10 IS 'Avez-vous payé des frais de garde d''enfants en 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d11 IS 'Frais de garde : par enfant et gardien — nom, NAS/NEQ, montants, semaines [feuillet : CHILDCARE_RECEIPT] [affiché si : d10=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d12 IS 'Avez-vous eu des frais de déménagement en 2025 (au moins 40 km du travail/études) ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d13 IS 'Payez-vous une pension alimentaire déductible ? — Indice : Montant annuel, bénéficiaire, date de l''ordonnance [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d14 IS 'Intérêts et frais d''emprunt payés pour gagner un revenu de placement ou d''entreprise [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d15 IS 'Votre employeur vous a-t-il signé un T2200 ? (dépenses : fournitures, bureau, véhicule) [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d16 IS 'Êtes-vous membre du clergé admissible à la déduction pour résidence ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d17 IS 'Avez-vous droit à la déduction pour les habitants de régions éloignées (T2222) ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d18 IS 'Déduction pour options d''achat d''actions [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d19 IS 'Avez-vous des pertes d''entreprise, agricoles ou autres qu''en capital d''années antérieures à appliquer ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d20 IS 'Remboursement de prestations d''AE ou de SV inclus dans le revenu [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d21 IS 'Avez-vous des frais de scolarité à déclarer ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d22 IS 'Frais de scolarité payés en 2025 (T2202) : montant, établissement [montant en CENTS] [feuillet : T2202] [affiché si : d21=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d23 IS 'Montants inutilisés de frais de scolarité d''années antérieures [montant en CENTS] [affiché si : d21=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d24 IS 'Transférez-vous des frais de scolarité à un parent, ou recevez-vous un transfert d''un enfant ? [affiché si : d21=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d25 IS 'Intérêts payés en 2025 sur un prêt étudiant [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d26 IS 'Avez-vous des frais médicaux à déclarer ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d27 IS 'Frais médicaux 2025 pour vous, conjoint et enfants (ordonnances, dentaire, lunettes, primes d''assurance) [feuillet : MEDICAL_RECEIPTS] [affiché si : d26=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d28 IS 'Avez-vous fait des dons de bienfaisance ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d29 IS 'Dons de bienfaisance et dons politiques fédéraux 2025 (reçus, montants, reports 5 ans) [feuillet : DONATION_RECEIPT] [affiché si : d28=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d30 IS 'Cotisation au RPC/RRQ à payer sur un revenu de travail autonome [montant en CENTS] [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d31 IS 'Êtes-vous inscrit volontairement à l''assurance-emploi pour travailleurs autonomes ? [affiché si : t2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d32 IS 'Cotisation au RQAP à payer sur un revenu de travail autonome ou hors Québec [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d33 IS 'Impôt minimum de remplacement fédéral (T691) : importantes déductions demandées ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d34 IS 'Remboursement de la pension de la SV (récupération si revenu net dépasse le seuil) ?';
--> statement-breakpoint
COMMENT ON COLUMN q_deductions.d35 IS 'Retenues d''impôt insuffisantes — impôt fédéral et provincial retenus à la source (T4/RL-1) [montant en CENTS]';
--> statement-breakpoint
-- ─── q_credits — Étape 10 — Crédits d'impôt ───
CREATE TABLE IF NOT EXISTS q_credits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  c1 BOOLEAN,
  c2 BOOLEAN,
  c3 BOOLEAN,
  c4 BOOLEAN,
  c5 BOOLEAN,
  c6 BOOLEAN,
  c7 BOOLEAN,
  c8 BOOLEAN,
  c9 BOOLEAN,
  c10 BOOLEAN,
  c11 INTEGER,
  c12 INTEGER,
  c13 BOOLEAN,
  c14 BOOLEAN,
  c15 INTEGER,
  c16 BOOLEAN,
  c17 BOOLEAN,
  c18 BOOLEAN,
  c19 BOOLEAN,
  c20 TEXT[],
  c21 INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_credits IS 'Étape 10 — Crédits d''impôt';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c1 IS 'Aviez-vous 65 ans ou plus au 31 décembre 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c2 IS 'Votre époux/conjoint a-t-il un revenu net inférieur au montant personnel de base ? [affiché si : t6=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c3 IS 'Subvenez-vous aux besoins d''une personne à charge admissible vivant avec vous ?';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c4 IS 'Prenez-vous soin d''une personne à charge de 18 ans ou plus atteinte d''une déficience ?';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c5 IS 'Êtes-vous admissible au crédit d''impôt pour personnes handicapées (CIPH, T2201 approuvé) ? [feuillet : T2201]';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c6 IS 'Une personne à charge admissible au CIPH transfère-t-elle une partie inutilisée de son crédit ?';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c7 IS 'Montant canadien pour emploi (si revenu d''emploi en 2025) [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c8 IS 'Avez-vous reçu un revenu de pension admissible ? (jusqu''à 2 000 $)';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c9 IS 'Êtes-vous pompier volontaire ou volontaire en recherche et sauvetage (200 h ou plus) ?';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c10 IS 'Avez-vous acheté une première habitation admissible en 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c11 IS 'Avez-vous engagé des dépenses pour l''accessibilité domiciliaire ? [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c12 IS 'Avez-vous payé des frais d''adoption en 2025 ? [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c13 IS 'Votre époux/conjoint vous transfère-t-il des crédits inutilisés (annexe 2) ? [affiché si : t6=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c14 IS 'Avez-vous accumulé des droits au crédit canadien pour la formation ?';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c15 IS 'Cotisations employé au RPC/RRQ, AE et RQAP (cases des T4) [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c16 IS 'Enfants à charge de moins de 18 ans au 31 décembre (ACE) — garde partagée ? [affiché si : t6=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c17 IS 'Demandez-vous l''Allocation canadienne pour les travailleurs (ACT) ?';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c18 IS 'Avez-vous demandé la Prestation canadienne pour les personnes handicapées ?';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c19 IS 'Crédit pour la TPS/TVH : confirmez votre état civil et vos enfants';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c20 IS 'Crédits remboursables d''autres provinces/territoires (OTB ontarien, crédit TV de la C.-B., etc.)';
--> statement-breakpoint
COMMENT ON COLUMN q_credits.c21 IS 'Avez-vous un solde d''impôt à recevoir ou à payer selon votre avis de cotisation 2024 ? [montant en CENTS]';
--> statement-breakpoint
-- ─── q_quebec — Étape 11 — Spécificités Québec ───
CREATE TABLE IF NOT EXISTS q_quebec (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  q1 VARCHAR(100) CHECK (q1 IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT')),
  q2 BOOLEAN,
  q3 VARCHAR(100) CHECK (q3 IN ('employee', 'self')),
  q4 BOOLEAN,
  q5 VARCHAR(100) CHECK (q5 IN ('employee', 'self')),
  q6 BOOLEAN,
  q7 INTEGER,
  q8 INTEGER,
  q9 INTEGER,
  q10 INTEGER,
  q11 BOOLEAN,
  q12 INTEGER,
  q13 BOOLEAN,
  q14 INTEGER,
  q15 INTEGER,
  q16 BOOLEAN,
  q17 INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_quebec IS 'Étape 11 — Spécificités Québec';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q1 IS 'Province de résidence au 31 décembre 2025';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q2 IS 'Avez-vous versé des contributions politiques provinciales en 2025 ? [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q3 IS 'Cotisation au RRQ : salarié (feuillets) ou travailleur autonome ? [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q4 IS 'Avez-vous choisi de cesser de cotiser au RRQ (60 à 70 ans, CPT30) ? [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q5 IS 'Cotisation au RQAP : salarié (RL-1) ou travailleur autonome/hors Québec ? [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q6 IS 'Assurance médicaments du Québec : couvert TOUTE l''année par une assurance privée ? [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q7 IS 'Avez-vous payé une prime à l''assurance médicaments du Québec en 2025 ? [montant en CENTS] [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q8 IS 'Contribution santé 2025 (revenu net entre 18 130 $ et 150 000 $) [montant en CENTS] [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q9 IS 'Avez-vous payé un loyer au Québec en 2025 ? — Indice : Pour le crédit de solidarité [montant en CENTS] [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q10 IS 'Avez-vous payé des taxes foncières au Québec en 2025 ? — Indice : Pour le crédit de solidarité [montant en CENTS] [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q11 IS 'Avez-vous demandé le crédit pour maintien à domicile (personne de 70 ans ou plus) ? [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q12 IS 'Avez-vous des actions admissibles du Fonds de solidarité FTQ ou Fondaction ? [montant en CENTS] [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q13 IS 'Avez-vous fait des dons à des organismes culturels ou de bienfaisance (reçus TP-726.8.1) ? [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q14 IS 'Avez-vous engagé des frais pour rénovation écoresponsable (RénoVert ou LogisVert) ? [montant en CENTS] [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q15 IS 'Frais de scolarité québécois (relevé 8) non encore demandés [montant en CENTS] [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q16 IS 'Crédit pour les travailleurs d''expérience (55 ans ou plus, revenu de travail) [province : QC]';
--> statement-breakpoint
COMMENT ON COLUMN q_quebec.q17 IS 'Remboursement de l''impôt des particuliers du Québec retenu à la source [montant en CENTS] [province : QC]';
--> statement-breakpoint
-- ─── q_documents — Étape 12 — Documents et feuillets ───
CREATE TABLE IF NOT EXISTS q_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  doc1 UUID,
  doc2 UUID,
  doc3 UUID,
  doc4 UUID,
  doc5 UUID,
  doc6 UUID,
  doc7 UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_documents IS 'Étape 12 — Documents et feuillets';
--> statement-breakpoint
COMMENT ON COLUMN q_documents.doc1 IS 'T4 — Rémunération d''un employeur — Indice : Ajoutez un bloc par employeur (T4 #1, T4 #2...) [feuillet : T4] [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_documents.doc2 IS 'Relevé 1 (RL-1) — Revenus d''emploi (Québec) — Indice : Un RL-1 par employeur [feuillet : RL-1] [affiché si : t1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_documents.doc3 IS 'T5 — Relevé de revenus de placements — Indice : Un T5 par institution financière [feuillet : T5] [affiché si : t4=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_documents.doc4 IS 'T4A — Autres revenus (pension, bourses, case 048...) — Indice : Pension, bourses, allocations de retraite [feuillet : T4A]';
--> statement-breakpoint
COMMENT ON COLUMN q_documents.doc5 IS 'T4E — Prestations d''assurance-emploi [feuillet : T4E] [affiché si : r13=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_documents.doc6 IS 'Reçus de cotisation REER — Indice : Reçus de votre institution financière [feuillet : RRSP_RECEIPT] [affiché si : d1=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_documents.doc7 IS 'Autres documents fiscaux — Indice : T3, T5013, RL-2, T2202, reçus médicaux, dons, etc.';
--> statement-breakpoint
-- ─── q_revision — Étape 13 — Révision et signature ───
CREATE TABLE IF NOT EXISTS q_revision (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  rev1 BOOLEAN,
  rev2 BOOLEAN,
  rev3 TEXT,
  rev4 BOOLEAN,
  rev5 BOOLEAN,
  rev6 BOOLEAN,
  rev7 BOOLEAN,
  rev8 BOOLEAN,
  rev9 BOOLEAN,
  rev10 TEXT,
  rev11 BOOLEAN,
  rev12 TEXT,
  rev13 DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_revision IS 'Étape 13 — Révision et signature';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev1 IS 'Avez-vous des dettes fiscales impayées auprès de l''ARC ou de Revenu Québec ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev2 IS 'Souhaitez-vous souscrire au dépôt direct pour recevoir votre remboursement ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev3 IS 'Numéro de compte bancaire pour dépôt direct (institution, transit, compte) [affiché si : rev2=true]';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev4 IS 'Souhaitez-vous verser une somme à un REER, CELIAPP ou CELI ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev5 IS 'Avez-vous reçu un avis de cotisation ou une demande de renseignements de l''ARC en 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev6 IS 'Avez-vous été cotisé en trop les années précédentes (droits à un remboursement non réclamé) ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev7 IS 'Désirez-vous que votre préparateur reçoive votre avis de cotisation ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev8 IS 'Autorisez-vous votre préparateur à discuter de votre dossier avec l''ARC ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev9 IS 'Autorisez-vous votre préparateur à discuter de votre dossier avec Revenu Québec ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev10 IS 'Avez-vous des commentaires ou des situations particulières à signaler à votre préparateur ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev11 IS 'Confirmez-vous que toutes les informations fournies sont complètes et exactes à votre connaissance ?';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev12 IS 'Signature électronique';
--> statement-breakpoint
COMMENT ON COLUMN q_revision.rev13 IS 'Date de signature';
--> statement-breakpoint
-- ─── q_ma_province — Questions conditionnelles par province/territoire (52) ───
-- Table éparse : seule la province de l'usager est renseignée.
CREATE TABLE IF NOT EXISTS q_ma_province (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  on_01 INTEGER,
  on_02 INTEGER,
  on_03 BOOLEAN,
  on_04 BOOLEAN,
  on_05 INTEGER,
  on_06 INTEGER,
  on_07 INTEGER,
  on_08 BOOLEAN,
  bc_01 BOOLEAN,
  bc_02 BOOLEAN,
  bc_03 BOOLEAN,
  bc_04 INTEGER,
  bc_05 BOOLEAN,
  ab_01 INTEGER,
  ab_02 INTEGER,
  sk_01 TEXT,
  sk_02 BOOLEAN,
  sk_03 INTEGER,
  sk_04 INTEGER,
  sk_05 INTEGER,
  mb_01 BOOLEAN,
  mb_02 BOOLEAN,
  mb_03 BOOLEAN,
  mb_04 INTEGER,
  mb_05 TEXT[],
  nb_01 INTEGER,
  nb_02 BOOLEAN,
  nb_03 INTEGER,
  ns_01 BOOLEAN,
  ns_02 INTEGER,
  pe_01 INTEGER,
  pe_02 BOOLEAN,
  pe_03 INTEGER,
  pe_04 INTEGER,
  nl_01 INTEGER,
  nl_02 BOOLEAN,
  nl_03 INTEGER,
  nl_04 INTEGER,
  nt_01 INTEGER,
  nt_02 INTEGER,
  nu_02 INTEGER,
  nu_03 BOOLEAN,
  nu_04 BOOLEAN,
  nu_05 INTEGER,
  yt_02 INTEGER,
  yt_03 INTEGER,
  yt_04 BOOLEAN,
  yt_05 INTEGER,
  yt_06 INTEGER,
  yt_07 INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE q_ma_province IS 'Questions conditionnelles par province/territoire (provinceOnly).';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.on_01 IS 'Avez-vous payé un loyer pour votre résidence principale en Ontario en 2025 ? Si oui, quel montant total ? [montant en CENTS] [province : ON]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.on_02 IS 'Avez-vous payé des impôts fonciers pour votre résidence principale en Ontario en 2025 ? Si oui, quel montant ? [montant en CENTS] [province : ON]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.on_03 IS 'Votre résidence principale était-elle située dans le Nord de l''Ontario (p. ex. Sudbury, Thunder Bay, Timmins, North Bay, Sault Ste. Marie) ? [province : ON]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.on_04 IS 'Avez-vous payé des frais d''énergie sur une réserve, des frais d''hébergement en foyer de soins de longue durée public, ou vécu en résidence étudiante désignée ? [province : ON]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.on_05 IS 'Avez-vous payé des frais de garde d''enfants en 2025 (garderie, camp de jour) ? Quel montant ? [montant en CENTS] [province : ON]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.on_06 IS 'Aviez-vous 70 ans ou plus et avez-vous engagé des frais médicaux pour des soins à domicile en 2025 ? Quel montant ? [montant en CENTS] [province : ON]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.on_07 IS 'Avez-vous versé des contributions à un parti politique provincial ou à un candidat ontarien en 2025 ? Quel montant ? [montant en CENTS] [province : ON]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.on_08 IS 'Aviez-vous 64 ans ou plus et étiez-vous propriétaire occupant de votre résidence en 2025 ? [province : ON]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.bc_01 IS 'Étiez-vous locataire de votre résidence principale en Colombie-Britannique en 2025 ? [province : BC]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.bc_02 IS 'Avez-vous suivi une formation professionnelle admissible en C.-B. en 2025 ? [province : BC]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.bc_03 IS 'Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage en C.-B. en 2025 (200 heures ou plus) ? [province : BC]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.bc_04 IS 'Avez-vous versé des contributions à un parti politique provincial ou à un candidat en C.-B. en 2025 ? Quel montant ? [montant en CENTS] [province : BC]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.bc_05 IS 'Étiez-vous parent seul (monoparental) en 2025 ? [province : BC]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.ab_01 IS 'Avez-vous versé des contributions à un parti politique provincial, à un candidat ou à une association de candidat potentiel en Alberta en 2025 ? Quel montant ? [montant en CENTS] [province : AB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.ab_02 IS 'Avez-vous fait des dons de bienfaisance en 2025 ? Quel montant ? [montant en CENTS] [province : AB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.sk_01 IS 'Êtes-vous diplômé d''un établissement postsecondaire de la Saskatchewan ? Si oui, année d''obtention et type de diplôme ? [province : SK]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.sk_02 IS 'Avez-vous acheté une première habitation en Saskatchewan depuis le 1er octobre 2024 ? [province : SK]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.sk_03 IS 'Avez-vous engagé des dépenses de rénovation domiciliaire en 2025 ? Quel montant ? [montant en CENTS] [province : SK]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.sk_04 IS 'Vos enfants étaient-ils inscrits à des activités sportives, culturelles ou récréatives en 2025 ? Quel montant par enfant ? [montant en CENTS] [province : SK]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.sk_05 IS 'Avez-vous engagé des dépenses de traitement de fertilité en 2025 ? Quel montant ? (Une seule demande à vie.) [montant en CENTS] [province : SK]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.mb_01 IS 'Étiez-vous locataire au Manitoba en 2025 ? [province : MB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.mb_02 IS 'Étiez-vous propriétaire occupant de votre résidence principale au Manitoba en 2025 ? [province : MB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.mb_03 IS 'Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage au Manitoba en 2025 ? [province : MB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.mb_04 IS 'Avez-vous engagé des dépenses de traitement de fertilité en 2025 ? Quel montant ? [montant en CENTS] [province : MB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.mb_05 IS 'Précisez vos personnes à charge : conjoint, 65 ans+, invalidité, enfants de 18 ans ou moins (nombre) ? [province : MB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nb_01 IS 'Avez-vous versé des contributions à un parti politique provincial ou à un candidat au Nouveau-Brunswick en 2025 ? Quel montant ? [montant en CENTS] [province : NB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nb_02 IS 'Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage au Nouveau-Brunswick en 2025 ? [province : NB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nb_03 IS 'Avez-vous investi dans une petite entreprise du Nouveau-Brunswick en 2025 ? Quel montant ? [montant en CENTS] [province : NB]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.ns_01 IS 'Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage en Nouvelle-Écosse en 2025 ? [province : NS]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.ns_02 IS 'Avez-vous versé des contributions à un parti politique provincial ou à un candidat en Nouvelle-Écosse en 2025 ? Quel montant ? [montant en CENTS] [province : NS]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.pe_01 IS 'Avez-vous payé des dépenses pour le bien-être de vos enfants en 2025 (activités, équipements) ? Quel montant ? [montant en CENTS] [province : PE]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.pe_02 IS 'Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage à l''Î.-P.-É. en 2025 ? [province : PE]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.pe_03 IS 'Aviez-vous des enfants de moins de 6 ans à charge en 2025 ? Combien ? [province : PE]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.pe_04 IS 'Avez-vous versé des contributions à un parti politique provincial ou à un candidat à l''Î.-P.-É. en 2025 ? Quel montant ? [montant en CENTS] [province : PE]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nl_01 IS 'Avez-vous payé des frais de chauffage au mazout pour votre résidence en 2025 ? Quel montant ? [montant en CENTS] [province : NL]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nl_02 IS 'Étiez-vous pompier volontaire ou volontaire en recherche et sauvetage à T.-N.-L. en 2025 ? [province : NL]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nl_03 IS 'Avez-vous payé des frais de garde d''enfants ou des frais d''adoption en 2025 ? Quel montant ? [montant en CENTS] [province : NL]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nl_04 IS 'Avez-vous versé des contributions à un parti politique provincial ou à un candidat à T.-N.-L. en 2025 ? Quel montant ? [montant en CENTS] [province : NL]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nt_01 IS 'Combien de jours avez-vous résidé dans une zone prescrite du Nord en 2025 ? [province : NT,NU,YT]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nt_02 IS 'Avez-vous versé des contributions politiques territoriales aux T.N.-O. en 2025 ? Quel montant ? [montant en CENTS] [province : NT]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nu_02 IS 'Aviez-vous des enfants de moins de 6 ans à charge en 2025 ? Combien ? [province : NU]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nu_03 IS 'Étiez-vous parent seul à un moment en 2025 ? [province : NU]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nu_04 IS 'Avez-vous été bénévole comme pompier ou en recherche et sauvetage au Nunavut en 2025 (50 heures ou plus) ? [province : NU]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.nu_05 IS 'Avez-vous versé des contributions politiques territoriales au Nunavut en 2025 ? Quel montant ? [montant en CENTS] [province : NU]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.yt_02 IS 'Avez-vous engagé des dépenses de fertilité ou de maternité de substitution en 2025 (traitements après le 2 janvier 2024) ? Quel montant ? [montant en CENTS] [province : YT]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.yt_03 IS 'Avez-vous investi dans une entreprise admissible du Yukon en 2025 (certificat YBITC-1) ? Quel montant ? [montant en CENTS] [province : YT]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.yt_04 IS 'Résidiez-vous sur des terres visées par une entente d''une Première Nation du Yukon en 2025 ? [province : YT]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.yt_05 IS 'Avez-vous payé des frais d''activités physiques pour vos enfants en 2025 ? Quel montant par enfant ? [montant en CENTS] [province : YT]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.yt_06 IS 'Avez-vous payé des frais d''adoption en 2025 ? Quel montant ? [montant en CENTS] [province : YT]';
--> statement-breakpoint
COMMENT ON COLUMN q_ma_province.yt_07 IS 'Avez-vous versé des contributions politiques territoriales au Yukon en 2025 ? Quel montant ? [montant en CENTS] [province : YT]';
--> statement-breakpoint
-- ─── q_dependants — Personnes à charge (question f6, 1:N) ───
CREATE TABLE IF NOT EXISTS q_dependants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES q_sessions(id) ON DELETE CASCADE,
  nom             VARCHAR(200),
  lien_parente    VARCHAR(100),
  date_naissance  DATE,
  revenu_net_cents INTEGER,
  est_etudiant    BOOLEAN,
  handicap        BOOLEAN,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_q_dependants_session ON q_dependants(session_id);
--> statement-breakpoint
COMMENT ON TABLE q_dependants IS 'Une ligne par personne à charge (question f6 du module Famille). Montant en cents.';
--> statement-breakpoint
-- ─── qb_triage — Entreprise — Triage (3 questions) ───
CREATE TABLE IF NOT EXISTS qb_triage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  bt1 BOOLEAN,
  bt2 BOOLEAN,
  bt3 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_triage IS 'Entreprise — Triage (3 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_triage.bt1 IS 'L''entreprise a-t-elle eu des employés en 2025 ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_triage.bt2 IS 'L''entreprise est-elle inscrite aux taxes (TPS/TVH et/ou TVQ) ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_triage.bt3 IS 'L''entreprise a-t-elle acheté ou vendu des immobilisations en 2025 ? (véhicule, équipement, immeuble)';
--> statement-breakpoint
-- ─── qb_identification — Entreprise — Identification (12 questions) ───
CREATE TABLE IF NOT EXISTS qb_identification (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  bi1 TEXT,
  bi2 TEXT,
  bi3 TEXT,
  bi4 TEXT,
  bi5 TEXT[],
  bi6 DATE,
  bi7 DATE,
  bi8 JSONB,
  bi9 TEXT,
  bi10 TEXT,
  bi11 JSONB,
  bi12 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_identification IS 'Entreprise — Identification (12 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi1 IS 'Dénomination sociale légale de l''entreprise';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi2 IS 'Nom commercial (si différent de la dénomination sociale)';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi3 IS 'Numéro d''entreprise du Québec (NEQ, 10 chiffres)';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi4 IS 'Numéro d''entreprise de l''ARC (9 chiffres)';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi5 IS 'Comptes de programme ARC ouverts';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi6 IS 'Début de l''exercice financier 2025';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi7 IS 'Fin de l''exercice financier 2025';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi8 IS 'Adresse de l''établissement principal';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi9 IS 'Numéro de téléphone de l''entreprise';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi10 IS 'Adresse courriel de l''entreprise';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi11 IS 'Personne-contact (nom, titre, téléphone)';
--> statement-breakpoint
COMMENT ON COLUMN qb_identification.bi12 IS 'La déclaration T2 et CO-17 de l''exercice précédent a-t-elle été produite ?';
--> statement-breakpoint
-- ─── qb_structure — Entreprise — Structure juridique (10 questions) ───
CREATE TABLE IF NOT EXISTS qb_structure (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  bs1 VARCHAR(100) CHECK (bs1 IN ('corp', 'partnership', 'sole_prop', 'coop', 'other')),
  bs2 DATE,
  bs3 VARCHAR(100) CHECK (bs3 IN ('federal', 'QC', 'ON', 'BC', 'other')),
  bs4 INTEGER,
  bs5 JSONB,
  bs6 BOOLEAN,
  bs7 TEXT,
  bs8 BOOLEAN,
  bs9 BOOLEAN,
  bs10 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_structure IS 'Entreprise — Structure juridique (10 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs1 IS 'Forme juridique de l''entreprise';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs2 IS 'Date de constitution (ou d''immatriculation)';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs3 IS 'Juridiction de constitution';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs4 IS 'Nombre d''actionnaires ou d''associés';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs5 IS 'Pour chaque actionnaire/associé : nom, NAS ou NE, pourcentage de participation, résident du Canada ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs6 IS 'Existe-t-il une convention entre actionnaires (ou entre associés) ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs7 IS 'Catégories d''actions émises (ex. : A votantes, B participantes)';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs8 IS 'L''exercice financier a-t-il changé par rapport à l''année précédente ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs9 IS 'L''entreprise est-elle associée à d''autres sociétés (groupe de sociétés) ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_structure.bs10 IS 'L''entreprise demande-t-elle la déduction pour petite entreprise (DPE) ?';
--> statement-breakpoint
-- ─── qb_activites — Entreprise — Activités (8 questions) ───
CREATE TABLE IF NOT EXISTS qb_activites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  ba1 TEXT,
  ba2 TEXT,
  ba3 TEXT,
  ba4 DATE,
  ba5 BOOLEAN,
  ba6 BOOLEAN,
  ba7 TEXT,
  ba8 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_activites IS 'Entreprise — Activités (8 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_activites.ba1 IS 'Description de l''activité principale';
--> statement-breakpoint
COMMENT ON COLUMN qb_activites.ba2 IS 'Code SCIAN (6 chiffres) de l''activité principale';
--> statement-breakpoint
COMMENT ON COLUMN qb_activites.ba3 IS 'Activités secondaires, le cas échéant';
--> statement-breakpoint
COMMENT ON COLUMN qb_activites.ba4 IS 'Date de début des activités de l''entreprise';
--> statement-breakpoint
COMMENT ON COLUMN qb_activites.ba5 IS 'L''entreprise exerce-t-elle des activités à l''extérieur du Canada ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_activites.ba6 IS 'L''entreprise a-t-elle un établissement stable dans une autre province ou à l''étranger ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_activites.ba7 IS 'Site Web de l''entreprise';
--> statement-breakpoint
COMMENT ON COLUMN qb_activites.ba8 IS 'L''activité est-elle saisonnière ?';
--> statement-breakpoint
-- ─── qb_revenus — Entreprise — Revenus (12 questions) ───
CREATE TABLE IF NOT EXISTS qb_revenus (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  br1 INTEGER,
  br2 INTEGER,
  br3 INTEGER,
  br4 INTEGER,
  br5 INTEGER,
  br6 INTEGER,
  br7 INTEGER,
  br8 INTEGER,
  br9 INTEGER,
  br10 INTEGER,
  br11 BOOLEAN,
  br12 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_revenus IS 'Entreprise — Revenus (12 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br1 IS 'Ventes brutes de biens (marchandises) — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br2 IS 'Ventes brutes de services — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br3 IS 'Retours, rabais et escomptes accordés — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br4 IS 'Revenus d''intérêts — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br5 IS 'Subventions reçues (gouvernementales ou autres) — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br6 IS 'Revenus de location — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br7 IS 'Commissions gagnées — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br8 IS 'Autres revenus d''entreprise — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br9 IS 'Créances douteuses recouvrées — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br10 IS 'Chiffre d''affaires total 2025 (pour validation) [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br11 IS 'Une partie des revenus a-t-elle été encaissée en espèces ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_revenus.br12 IS 'Des ventes ont-elles été réalisées avec des personnes liées ?';
--> statement-breakpoint
-- ─── qb_depenses — Entreprise — Dépenses (22 questions) ───
CREATE TABLE IF NOT EXISTS qb_depenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  bd1 INTEGER,
  bd2 INTEGER,
  bd3 INTEGER,
  bd4 INTEGER,
  bd5 INTEGER,
  bd6 INTEGER,
  bd7 INTEGER,
  bd8 INTEGER,
  bd9 INTEGER,
  bd10 INTEGER,
  bd11 INTEGER,
  bd12 INTEGER,
  bd13 INTEGER,
  bd14 INTEGER,
  bd15 INTEGER,
  bd16 INTEGER,
  bd17 INTEGER,
  bd18 INTEGER,
  bd19 INTEGER,
  bd20 INTEGER,
  bd21 INTEGER,
  bd22 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_depenses IS 'Entreprise — Dépenses (22 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd1 IS 'Publicité et promotion — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd2 IS 'Repas et divertissement — montant 2025 (50 % déductible) [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd3 IS 'Créances irrécouvrables — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd4 IS 'Assurances (responsabilité, biens, etc.) — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd5 IS 'Intérêts et frais bancaires — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd6 IS 'Taxes d''affaires, permis et droits — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd7 IS 'Entretien et réparations — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd8 IS 'Honoraires professionnels (comptable, avocat, consultants) — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd9 IS 'Loyer commercial — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd10 IS 'Fournitures de bureau — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd11 IS 'Sous-traitants — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd12 IS 'Déplacements d''affaires (transport, hébergement) — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd13 IS 'Frais de véhicule d''entreprise (essence, entretien, assurance) — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd14 IS 'Services publics (électricité, chauffage, eau) — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd15 IS 'Télécommunications (téléphone, Internet) — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd16 IS 'Formation et perfectionnement — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd17 IS 'Salaires et traitements (hors DAS) — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd18 IS 'Frais de gestion — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd19 IS 'Livraison, transport et messagerie — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd20 IS 'Logiciels et abonnements — montant 2025 [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd21 IS 'Autres dépenses d''exploitation — montant 2025 (préciser) [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_depenses.bd22 IS 'Certaines dépenses comportent-elles un usage personnel (à rajuster) ?';
--> statement-breakpoint
-- ─── qb_paie — Entreprise — Paie (11 questions) ───
CREATE TABLE IF NOT EXISTS qb_paie (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  bp1 INTEGER,
  bp2 INTEGER,
  bp3 BOOLEAN,
  bp4 INTEGER,
  bp5 INTEGER,
  bp6 INTEGER,
  bp7 INTEGER,
  bp8 INTEGER,
  bp9 BOOLEAN,
  bp10 BOOLEAN,
  bp11 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_paie IS 'Entreprise — Paie (11 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp1 IS 'Nombre d''employés en 2025 (y compris temps partiel) [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp2 IS 'Masse salariale brute totale 2025 [montant en CENTS] [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp3 IS 'Des feuillets T4 et relevés 1 (RL-1) ont-ils été émis ? [feuillet : T4] [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp4 IS 'Cotisations de l''employeur au RPC/RRQ — montant 2025 [montant en CENTS] [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp5 IS 'Cotisations de l''employeur à l''assurance-emploi — montant 2025 [montant en CENTS] [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp6 IS 'Cotisation au Fonds des services de santé (FSS, Québec) — montant 2025 [montant en CENTS] [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp7 IS 'Primes CNESST (Québec) — montant 2025 [montant en CENTS] [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp8 IS 'Avantages imposables versés aux employés — montant 2025 [montant en CENTS] [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp9 IS 'Des actionnaires sont-ils aussi employés (salaire vs dividendes) ? [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp10 IS 'Le compte de programme RP (retenues sur la paie) est-il actif ? [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_paie.bp11 IS 'Les DAS (déductions à la source) ont-ils été versés à temps ? [affiché si : bt1=true]';
--> statement-breakpoint
-- ─── qb_taxes — Entreprise — TPS/TVH/TVQ (11 questions) ───
CREATE TABLE IF NOT EXISTS qb_taxes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  btx1 BOOLEAN,
  btx2 TEXT,
  btx3 TEXT,
  btx4 VARCHAR(100) CHECK (btx4 IN ('monthly', 'quarterly', 'annual')),
  btx5 INTEGER,
  btx6 INTEGER,
  btx7 INTEGER,
  btx8 INTEGER,
  btx9 BOOLEAN,
  btx10 INTEGER,
  btx11 INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_taxes IS 'Entreprise — TPS/TVH/TVQ (11 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx1 IS 'L''entreprise est-elle inscrite à la TVQ ? [affiché si : bt2=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx2 IS 'Numéro de TPS/TVH (9 chiffres + RT0001) [affiché si : bt2=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx3 IS 'Numéro de TVQ (10 chiffres + TQ0001) [affiché si : btx1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx4 IS 'Fréquence de déclaration des taxes [affiché si : bt2=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx5 IS 'TPS/TVH perçue en 2025 [montant en CENTS] [affiché si : bt2=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx6 IS 'TVQ perçue en 2025 [montant en CENTS] [affiché si : btx1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx7 IS 'Crédits de taxe sur les intrants (CTI) demandés en 2025 [montant en CENTS] [affiché si : bt2=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx8 IS 'Remboursements de taxe sur les intrants (RTI, TVQ) demandés en 2025 [montant en CENTS] [affiché si : btx1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx9 IS 'L''entreprise utilise-t-elle la méthode rapide de comptabilité ? [affiché si : bt2=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx10 IS 'Fournitures taxables totales 2025 [montant en CENTS] [affiché si : bt2=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_taxes.btx11 IS 'Fournitures détaxées ou exonérées 2025 [montant en CENTS] [affiché si : bt2=true]';
--> statement-breakpoint
-- ─── qb_immo — Entreprise — Immobilisations (9 questions) ───
CREATE TABLE IF NOT EXISTS qb_immo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  bim1 TEXT,
  bim2 INTEGER,
  bim3 VARCHAR(100) CHECK (bim3 IN ('cat8', 'cat10', 'cat10a', 'cat12', 'cat14', 'cat50', 'other')),
  bim4 BOOLEAN,
  bim5 INTEGER,
  bim6 INTEGER,
  bim7 BOOLEAN,
  bim8 BOOLEAN,
  bim9 INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_immo IS 'Entreprise — Immobilisations (9 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_immo.bim1 IS 'Description des immobilisations acquises [affiché si : bt3=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_immo.bim2 IS 'Coût total des acquisitions 2025 [montant en CENTS] [affiché si : bt3=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_immo.bim3 IS 'Catégorie de DPA applicable [affiché si : bt3=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_immo.bim4 IS 'L''entreprise a-t-elle disposé (vendu) d''immobilisations en 2025 ? [affiché si : bt3=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_immo.bim5 IS 'Produit de disposition total 2025 [montant en CENTS] [affiché si : bim4=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_immo.bim6 IS 'Coût en capital initial des biens cédés [montant en CENTS] [affiché si : bim4=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_immo.bim7 IS 'Y a-t-il une récupération d''amortissement ou une perte finale ? [affiché si : bim4=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_immo.bim8 IS 'L''entreprise utilise-t-elle la règle de la demi-année pour les acquisitions 2025 ? [affiché si : bt3=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_immo.bim9 IS 'Inventaire de fin d''exercice (marchandises) [montant en CENTS]';
--> statement-breakpoint
-- ─── qb_documents — Entreprise — Documents (6 questions) ───
CREATE TABLE IF NOT EXISTS qb_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  bdoc1 BOOLEAN,
  bdoc2 BOOLEAN,
  bdoc3 BOOLEAN,
  bdoc4 BOOLEAN,
  bdoc5 BOOLEAN,
  bdoc6 TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_documents IS 'Entreprise — Documents (6 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_documents.bdoc1 IS 'États financiers (bilan et résultats) 2025 disponibles ? [feuillet : FINANCIAL_STATEMENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_documents.bdoc2 IS 'Grand livre général 2025 disponible ? [feuillet : GENERAL_LEDGER]';
--> statement-breakpoint
COMMENT ON COLUMN qb_documents.bdoc3 IS 'T4 et RL-1 émis aux employés [feuillet : T4] [affiché si : bt1=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_documents.bdoc4 IS 'Déclarations TPS/TVH et TVQ 2025 [feuillet : GST_RETURNS] [affiché si : bt2=true]';
--> statement-breakpoint
COMMENT ON COLUMN qb_documents.bdoc5 IS 'Contrats et conventions importants (ventes, achats, emprunts)';
--> statement-breakpoint
COMMENT ON COLUMN qb_documents.bdoc6 IS 'Autres documents pertinents à signaler';
--> statement-breakpoint
-- ─── qb_validation — Entreprise — Validation (5 questions) ───
CREATE TABLE IF NOT EXISTS qb_validation (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  bv1 BOOLEAN,
  bv2 INTEGER,
  bv3 BOOLEAN,
  bv4 TEXT,
  bv5 BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_validation IS 'Entreprise — Validation (5 questions)';
--> statement-breakpoint
COMMENT ON COLUMN qb_validation.bv1 IS 'Avez-vous des dettes fiscales impayées auprès de l''ARC ou de Revenu Québec ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_validation.bv2 IS 'Des acomptes provisionnels d''impôt ont-ils été versés en 2025 ? [montant en CENTS]';
--> statement-breakpoint
COMMENT ON COLUMN qb_validation.bv3 IS 'Autorisez-vous votre préparateur à discuter de votre dossier avec l''ARC et Revenu Québec ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_validation.bv4 IS 'Avez-vous des commentaires ou situations particulières à signaler ?';
--> statement-breakpoint
COMMENT ON COLUMN qb_validation.bv5 IS 'Confirmez-vous que toutes les informations fournies sont complètes et exactes ?';
--> statement-breakpoint
-- ─── qb_fiscalite_provinciale — Crédits d'impôt provinciaux des sociétés (45) ───
-- Table éparse : seule la province de la société est renseignée.
CREATE TABLE IF NOT EXISTS qb_fiscalite_provinciale (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL UNIQUE REFERENCES q_sessions(id) ON DELETE CASCADE,
  step_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  qc_e01 BOOLEAN,
  qc_e02 INTEGER,
  qc_e03 BOOLEAN,
  qc_e04 INTEGER,
  qc_e05 INTEGER,
  qc_e06 INTEGER,
  qc_e07 BOOLEAN,
  qc_e08 INTEGER,
  on_e01 INTEGER,
  on_e02 INTEGER,
  on_e03 INTEGER,
  on_e04 INTEGER,
  on_e05 INTEGER,
  on_e06 INTEGER,
  on_e07 BOOLEAN,
  ab_e01 INTEGER,
  ab_e02 INTEGER,
  ab_e03 BOOLEAN,
  bc_e01 INTEGER,
  bc_e02 INTEGER,
  bc_e03 INTEGER,
  sk_e01 INTEGER,
  sk_e02 INTEGER,
  sk_e03 INTEGER,
  sk_e04 INTEGER,
  mb_e01 INTEGER,
  mb_e02 INTEGER,
  mb_e03 INTEGER,
  mb_e04 INTEGER,
  nb_e01 INTEGER,
  nb_e02 INTEGER,
  ns_e01 INTEGER,
  ns_e02 INTEGER,
  ns_e03 INTEGER,
  ns_e04 INTEGER,
  pe_e01 INTEGER,
  pe_e02 INTEGER,
  nl_e01 INTEGER,
  nl_e02 INTEGER,
  nl_e03 INTEGER,
  nl_e04 INTEGER,
  nt_e01 INTEGER,
  nu_e01 INTEGER,
  yt_e01 BOOLEAN,
  yt_e02 INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE qb_fiscalite_provinciale IS 'Crédits d\'impôt provinciaux des sociétés (RS&DE, cinéma, médias numériques…).';
COMMENT ON COLUMN qb_fiscalite_provinciale.qc_e01 IS 'La société a-t-elle totalisé au moins 5 500 heures rémunérées en 2025 (ou l''année précédente) ? — Indice : Sans 5 500 heures : aucune déduction pour petites entreprises QC. Réduction linéaire entre 5 000 et 5 500 h. [province : QC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.qc_e02 IS 'La société a-t-elle engagé des dépenses de R-D, d''innovation ou de précommercialisation au Québec (exercices débutant après le 25 mars 2025) ? Quel montant ? — Indice : CRIC : 30% remboursable sur le premier 1 M$, 20% au-delà. Remplace 8 anciens crédits. [montant en CENTS] [province : QC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.qc_e03 IS 'La société exerce-t-elle des activités de développement des affaires électroniques intégrant l''IA dans une mesure importante (min. 6 employés à temps plein) ? — Indice : CDAE-IA : 30% au total en 2025 (23% remb. + 7% non remb.). [province : QC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.qc_e04 IS 'La société a-t-elle acquis de l''équipement ou des logiciels admissibles au Québec en 2025 (zone de vitalité économique) ? Quel montant ? — Indice : C3i remboursable : 15% / 20% / 25% selon la zone (jusqu''au 31 déc. 2029). [montant en CENTS] [province : QC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.qc_e05 IS 'La société a-t-elle engagé des dépenses de main-d''œuvre pour la production de titres multimédias au Québec en 2025 ? Quel montant ? — Indice : Multimédia QC : 37,5% (avec version française) / 30% / 26,25%. [montant en CENTS] [province : QC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.qc_e06 IS 'La société a-t-elle engagé des dépenses de production cinématographique ou télévisuelle au Québec en 2025 (SODEC) ? Quel montant ? — Indice : SODEC : 32%→40% (+8% animation/effets visuels, +8% régional). Services 25%+16%. Doublage 35%. [montant en CENTS] [province : QC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.qc_e07 IS 'La société réalise-t-elle un grand projet d''investissement au Québec (≥ 100 M$, ou 50 M$ en région désignée) ? — Indice : Nouveau congé fiscal 10 ans : 15%/20%/25% des dépenses, plafond 1 G$. [province : QC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.qc_e08 IS 'La société a-t-elle versé des salaires admissibles dans les médias écrits au Québec en 2025 ? Quel montant ? — Indice : Médias écrits QC : 35% (plafond 85 000$/employé). [montant en CENTS] [province : QC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.on_e01 IS 'La société a-t-elle engagé des dépenses admissibles de RS&DE en Ontario en 2025 ? Quel montant ? — Indice : OITC 8% remboursable (max 3 M$ de dépenses) + ORDTC 3,5% non remboursable — empilables. [montant en CENTS] [province : ON]';
COMMENT ON COLUMN qb_fiscalite_provinciale.on_e02 IS 'La société a-t-elle engagé des dépenses de R-D en vertu d''un contrat avec un institut de recherche admissible en Ontario en 2025 ? Quel montant ? — Indice : OBRITC 20% remboursable (max 4 M$/an). [montant en CENTS] [province : ON]';
COMMENT ON COLUMN qb_fiscalite_provinciale.on_e03 IS 'La société a-t-elle engagé des dépenses de production cinématographique ou télévisuelle en Ontario en 2025 ? Quel montant ? — Indice : OFTTC 35% main-d''œuvre (+10% régional, 40% débutants) · OPSTC 21,5% all-spend · OCASE 18% animation. [montant en CENTS] [province : ON]';
COMMENT ON COLUMN qb_fiscalite_provinciale.on_e04 IS 'La société a-t-elle développé des médias numériques interactifs (jeux vidéo) en Ontario en 2025 ? Quel montant de main-d''œuvre ? — Indice : OIDMTC 40% (produits non déterminés) / 35% (déterminés). [montant en CENTS] [province : ON]';
COMMENT ON COLUMN qb_fiscalite_provinciale.on_e05 IS 'La société (SPCC) a-t-elle acquis des biens en capital admissibles entre le 15 mai 2025 et le 31 décembre 2029 ? Quel montant ? — Indice : OMMITC 15% remboursable (nouveau 2025, temporaire, max 20 M$/an, jusqu''au 31 déc. 2029). [montant en CENTS] [province : ON]';
COMMENT ON COLUMN qb_fiscalite_provinciale.on_e06 IS 'La société a-t-elle investi plus de 50 000 $ dans un bâtiment commercial ou industriel en région désignée de l''Ontario en 2025 ? Quel montant ? — Indice : ROITC 10% remboursable (max 45 000$/an, aboli le 1er janv. 2027). [montant en CENTS] [province : ON]';
COMMENT ON COLUMN qb_fiscalite_provinciale.on_e07 IS 'La société a-t-elle exercé des activités de fabrication et transformation en Ontario en 2025 ? — Indice : Crédit M&P ON — taux effectif 10% (combiné fédéral + provincial). [province : ON]';
COMMENT ON COLUMN qb_fiscalite_provinciale.ab_e01 IS 'La société a-t-elle engagé des dépenses de R-D admissibles en Alberta en 2025 ? Quel montant ? — Indice : Innovation Employment Grant remboursable : 8% jusqu''au niveau de base + 20% sur le dépassement (plafond 4 M$ de dépenses/an). L''ancien crédit RS&DE albertain est aboli depuis 2020. [montant en CENTS] [province : AB]';
COMMENT ON COLUMN qb_fiscalite_provinciale.ab_e02 IS 'La société a-t-elle engagé des coûts de production cinématographique ou télévisuelle en Alberta en 2025 (min. 500 000 $) ? Quel montant ? — Indice : Film and Television Tax Credit AB remboursable : 22% ou 30% (plafond annuel 105 M$). [montant en CENTS] [province : AB]';
COMMENT ON COLUMN qb_fiscalite_provinciale.ab_e03 IS 'La société est-elle constituée en Alberta (déclaration provinciale AT1 distincte de la T2 fédérale) ? — Indice : L''Alberta administre son propre impôt des sociétés, comme le Québec. Déclaration AT1 obligatoire. [province : AB]';
COMMENT ON COLUMN qb_fiscalite_provinciale.bc_e01 IS 'La société a-t-elle engagé des dépenses admissibles de RS&DE en Colombie-Britannique en 2025 ? Quel montant ? — Indice : Crédit RS&DE C.-B. : 10% (remboursable si SPCC, non remboursable sinon). Incompatible avec IDMTC la même année. [montant en CENTS] [province : BC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.bc_e02 IS 'La société a-t-elle versé des salaires admissibles pour des médias numériques interactifs en C.-B. en 2025 ? Quel montant ? — Indice : IDMTC remboursable : 17,5% jusqu''au 31 août 2025, puis 25% dès le 1er sept. 2025 (rendu permanent). Incompatible avec RS&DE la même année. [montant en CENTS] [province : BC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.bc_e03 IS 'La société a-t-elle engagé des dépenses de production cinématographique en C.-B. en 2025 (Film Incentive BC ou Production Services) ? Quel montant ? — Indice : Film Incentive BC 35% (+12,5% régional, +6% région éloignée, +16% DAVE). Production Services 28% (+bonis). [montant en CENTS] [province : BC]';
COMMENT ON COLUMN qb_fiscalite_provinciale.sk_e01 IS 'La société a-t-elle acquis des biens admissibles de fabrication et transformation en Saskatchewan en 2025 ? Quel coût en capital ? — Indice : Crédit d''investissement M&T SK : 6% entièrement remboursable. [montant en CENTS] [province : SK]';
COMMENT ON COLUMN qb_fiscalite_provinciale.sk_e02 IS 'Des investisseurs ont-ils investi dans la société en 2025 (technologies, fabrication alimentaire/boissons, machinerie) ? Quel montant ? — Indice : STSI 45% non remboursable (plafond 7 M$/an, jusqu''au 31 mars 2027). SMEITC 45% non remboursable (pilote 1er juil. 2025–30 juin 2028, max 225 000$/an/investisseur). [montant en CENTS] [province : SK]';
COMMENT ON COLUMN qb_fiscalite_provinciale.sk_e03 IS 'La société tire-t-elle des revenus de propriété intellectuelle commercialisée en Saskatchewan ? Quel montant ? — Indice : SCII (« patent box ») : taux provincial réduit à 6% pendant 10 ans sur les revenus de PI admissible. [montant en CENTS] [province : SK]';
COMMENT ON COLUMN qb_fiscalite_provinciale.sk_e04 IS 'La société a-t-elle engagé des dépenses d''exploration minière en Saskatchewan en 2025 ? Quel montant ? — Indice : Crédit d''exploration minière SK (SMETC) : 30%. [montant en CENTS] [province : SK]';
COMMENT ON COLUMN qb_fiscalite_provinciale.mb_e01 IS 'La société a-t-elle acquis des biens admissibles de fabrication au Manitoba en 2025 (bâtiments, machinerie, équipement) ? Quel coût ? — Indice : MITC 8% = 1% non remboursable + 7% remboursable (report 3 ans arrière / 10 ans avant). [montant en CENTS] [province : MB]';
COMMENT ON COLUMN qb_fiscalite_provinciale.mb_e02 IS 'La société a-t-elle engagé des dépenses de R-D au Manitoba en 2025 ? Quel montant ? — Indice : Crédit R-D Manitoba : 20% partiellement remboursable. [montant en CENTS] [province : MB]';
COMMENT ON COLUMN qb_fiscalite_provinciale.mb_e03 IS 'La société a-t-elle engagé des dépenses de production cinématographique ou vidéo au Manitoba en 2025 ? Quel montant (salaires admissibles et/ou coût de production) ? — Indice : Film/vidéo MB entièrement remboursable : 45% des salaires (jusqu''à 65% avec bonis) OU 30% du coût de production (+8% = 38% si producteur manitobain). [montant en CENTS] [province : MB]';
COMMENT ON COLUMN qb_fiscalite_provinciale.mb_e04 IS 'La société a-t-elle engagé des dépenses admissibles de médias numériques interactifs au Manitoba en 2025 ? Quel montant ? — Indice : MIDMTC 40% remboursable (plafond 500 000$/projet). [montant en CENTS] [province : MB]';
COMMENT ON COLUMN qb_fiscalite_provinciale.nb_e01 IS 'La société a-t-elle engagé des dépenses admissibles de RS&DE au Nouveau-Brunswick en 2025 ? Quel montant ? — Indice : Crédit RS&DE NB : 15% entièrement remboursable (annexe T2SCH360). [montant en CENTS] [province : NB]';
COMMENT ON COLUMN qb_fiscalite_provinciale.nb_e02 IS 'La société a-t-elle engagé des dépenses de production cinématographique ou télévisuelle au Nouveau-Brunswick en 2025 ? Quel montant ? — Indice : Incitatif à la production NB (subvention, pas un crédit T2) : jusqu''à 40% des salaires (volet main-d''œuvre) ou 25%-30% all-spend. [montant en CENTS] [province : NB]';
COMMENT ON COLUMN qb_fiscalite_provinciale.ns_e01 IS 'La société a-t-elle engagé des dépenses admissibles de RS&DE en Nouvelle-Écosse en 2025 ? Quel montant ? — Indice : Crédit RS&DE NS : 15% entièrement remboursable. [montant en CENTS] [province : NS]';
COMMENT ON COLUMN qb_fiscalite_provinciale.ns_e02 IS 'La société a-t-elle engagé des dépenses admissibles de médias numériques en Nouvelle-Écosse en 2025 ? Quel montant ? — Indice : Médias numériques NS : 50% remboursable (+10% en zone désignée, dépenses avant le 1er janv. 2031). [montant en CENTS] [province : NS]';
COMMENT ON COLUMN qb_fiscalite_provinciale.ns_e03 IS 'La société a-t-elle engagé des dépenses d''animation numérique en Nouvelle-Écosse en 2025 (key animation) ? Quel montant ? — Indice : Animation NS : 50% + 17,5% de la main-d''œuvre d''animation (salaire admissible max 150 000$/employé). [montant en CENTS] [province : NS]';
COMMENT ON COLUMN qb_fiscalite_provinciale.ns_e04 IS 'La société a-t-elle investi dans une PME innovante admissible de la Nouvelle-Écosse en 2025 ? Quel montant ? — Indice : Équité pour l''innovation NS : 15% non remboursable (investissement 50 000$–500 000$/an, report 3 ans arrière / 7 ans avant). [montant en CENTS] [province : NS]';
COMMENT ON COLUMN qb_fiscalite_provinciale.pe_e01 IS 'La société a-t-elle acquis des biens en capital admissibles à l''Î.-P.-É. en 2025 ? Quel coût ? — Indice : Crédit d''impôt à l''investissement PE — non remboursable (taux à confirmer selon certificat provincial). [montant en CENTS] [province : PE]';
COMMENT ON COLUMN qb_fiscalite_provinciale.pe_e02 IS 'La société a-t-elle créé des postes à temps plein à l''Î.-P.-É. en 2025 (salaire brut ≥ 35 000 $/an) ? Combien ? — Indice : Innovation and Development Labour Rebate PE : remise de 25% des salaires admissibles (subvention provinciale, pas un crédit T2). [province : PE]';
COMMENT ON COLUMN qb_fiscalite_provinciale.nl_e01 IS 'La société a-t-elle engagé des dépenses admissibles de RS&DE à Terre-Neuve-et-Labrador en 2025 ? Quel montant ? — Indice : Crédit RS&DE NL : 15% remboursable. [montant en CENTS] [province : NL]';
COMMENT ON COLUMN qb_fiscalite_provinciale.nl_e02 IS 'La société a-t-elle engagé des dépenses de production cinématographique ou vidéo à T.-N.-L. en 2025 ? Quel montant (salaires admissibles et/ou coûts totaux) ? — Indice : Film NL remboursable : 40% (moindre de 40% des salaires ou 25% du budget, plafond 5 M$). Nouveau 2025 « all-spend » : 40% des coûts totaux, plafond 20 M$/projet. [montant en CENTS] [province : NL]';
COMMENT ON COLUMN qb_fiscalite_provinciale.nl_e03 IS 'La société a-t-elle engagé des dépenses admissibles de médias numériques interactifs à T.-N.-L. en 2025 ? Quel montant ? — Indice : Médias numériques NL 40% remboursable (plafonds 40 000$/employé/an et 2 M$/société/an, permanent). [montant en CENTS] [province : NL]';
COMMENT ON COLUMN qb_fiscalite_provinciale.nl_e04 IS 'La société a-t-elle investi dans des technologies vertes à T.-N.-L. en 2025 ? Quel montant ? — Indice : Crédit remboursable pour les technologies vertes NL. [montant en CENTS] [province : NL]';
COMMENT ON COLUMN qb_fiscalite_provinciale.nt_e01 IS 'La société a-t-elle versé des contributions politiques territoriales aux T.N.-O. en 2025 ? Quel montant ? — Indice : Crédit pour contributions politiques territoriales NT — max 500$ (100% des premiers 100$, 50% jusqu''à 900$). [montant en CENTS] [province : NT]';
COMMENT ON COLUMN qb_fiscalite_provinciale.nu_e01 IS 'La société a-t-elle versé des contributions politiques territoriales au Nunavut en 2025 ? Quel montant ? — Indice : Crédit pour contributions politiques territoriales NU — max 500$. [montant en CENTS] [province : NU]';
COMMENT ON COLUMN qb_fiscalite_provinciale.yt_e01 IS 'La société a-t-elle exercé des activités de fabrication et transformation au Yukon en 2025 ? — Indice : Yukon = seul territoire avec un taux M&P distinct : 2,5% (combiné 17,5%). Très avantageux pour la fabrication. [province : YT]';
COMMENT ON COLUMN qb_fiscalite_provinciale.yt_e02 IS 'La société a-t-elle versé des contributions politiques territoriales au Yukon en 2025 ? Quel montant ? — Indice : Crédit pour contributions politiques territoriales YT — max 650$. [montant en CENTS] [province : YT]';

-- ─── q_entry_map — Correspondance question → entrée fiscale (référentiel statique) ───
CREATE TABLE IF NOT EXISTS q_entry_map (
  question_id   VARCHAR(50) PRIMARY KEY,
  entry_kind    VARCHAR(20) NOT NULL
      CHECK (entry_kind IN ('revenu','deduction','credit','t2125','t2','cotisation','info')),
  entry_category VARCHAR(60) NOT NULL,
  notes         TEXT
);
COMMENT ON TABLE q_entry_map IS 'Référentiel : pour chaque question à montant, quelle entrée fiscale elle alimente. kind=info : pas d\'entrée directe (plafond, validation, question obsolète…).';
--> statement-breakpoint
-- Remplissage du référentiel
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('e3', 'revenu', 'employment', 'Pourboires non déclarés sur T4') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('a4', 'revenu', 'self_employment', 'Revenus bruts d''entreprise (T2125)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('a7', 't2125', 'self_employment', 'Dépense T2125 — publicité (réduit le revenu net)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('a8', 't2125', 'self_employment', 'Dépense T2125 — assurances') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('a9', 't2125', 'self_employment', 'Dépense T2125 — repas/représentation (50 %)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('a10', 'info', 'info', 'Inventaire de fin d''année (T2125)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('l2', 'revenu', 'rental', 'Revenus de location bruts') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('l4', 'revenu', 'rental', 'Quote-part de copropriété') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('r1', 'revenu', 'other_income', 'Allocation de retraite (transfert REER → voir d2)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('r5', 'revenu', 'other_income', 'Retrait REER — T4RSP, ligne 12900') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('r6', 'revenu', 'pension', 'Retrait FERR — T4RIF, ligne 11500') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('r17', 'deduction', 'other_deductions', 'Remboursement de prestations — ligne 23200') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('r18', 'revenu', 'other_income', 'Pension alimentaire reçue (imposable selon date de l''ordonnance)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('r19', 'revenu', 'other_income', 'Bourses d''études — T4A') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('r21', 'revenu', 'employment', 'Jetons de présence — ligne 10400') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('r22', 'revenu', 'other_income', 'Ristournes / subventions imposables') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d2', 'deduction', 'rrsp', 'Cotisations REER') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d3', 'info', 'info', 'Droits REER inutilisés (plafond, pas une entrée)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d4', 'deduction', 'rrsp', 'Cotisations au REER du conjoint') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d5', 'info', 'info', 'Remboursement RAP — annexe 7') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d6', 'info', 'info', 'Remboursement REEP — annexe 7') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d7', 'deduction', 'other_deductions', 'Cotisations CELIAPP — ligne 20810') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d8', 'deduction', 'other_deductions', 'Cotisations RPA/RPDB — ligne 20700') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d9', 'deduction', 'union_dues', 'Cotisations syndicales / professionnelles') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d13', 'deduction', 'other_deductions', 'Pension alimentaire payée — ligne 22000') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d14', 'deduction', 'carrying_charges', 'Intérêts d''emprunt pour placement/entreprise') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d18', 'deduction', 'other_deductions', 'Déduction options d''achat d''actions — ligne 24900') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d20', 'deduction', 'other_deductions', 'Remboursement AE/SV — ligne 23200') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d22', 'credit', 'tuition', 'Frais de scolarité T2202') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d23', 'credit', 'tuition', 'Frais de scolarité inutilisés (report)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d25', 'credit', 'other_credits', 'Intérêts sur prêt étudiant — ligne 31900') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d30', 'cotisation', 'rrq', 'Cotisation RRQ sur travail autonome — annexe 8') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d32', 'cotisation', 'rqap', 'Cotisation RQAP — annexe R') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('d35', 'info', 'info', 'Impôt retenu à la source (crédit 43700/451 — stocké sur tax_returns)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('c11', 'credit', 'other_credits', 'Crédit accessibilité domiciliaire') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('c12', 'credit', 'other_credits', 'Frais d''adoption') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('c15', 'credit', 'other_credits', 'Cotisations RPC/AE employé — crédits 30800/31200') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('c21', 'info', 'info', 'Solde de l''avis de cotisation 2024') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('q7', 'cotisation', 'ramq', 'Prime d''assurance médicaments QC — ligne 447') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('q8', 'info', 'info', 'OBSOLÈTE — Contribution santé abolie le 2017-01-01 : retirer du questionnaire') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('q9', 'credit', 'other_credits', 'Crédit solidarité QC — volet logement') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('q10', 'credit', 'other_credits', 'Crédit solidarité QC — volet propriété') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('q12', 'credit', 'other_credits', 'Crédit FTQ / Fondaction QC (15 %)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('q14', 'credit', 'other_credits', 'Rénovation écoresponsable — RénoVert TERMINÉ : reformuler (LogisVert/Chauffez vert/Rénoclimat)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('q15', 'credit', 'tuition', 'Frais de scolarité QC — relevé 8') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('q17', 'info', 'info', 'Remboursement d''impôt QC retenu à la source') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_01', 'credit', 'other_credits', 'Crédit Trillium ON — volet loyer') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_02', 'credit', 'other_credits', 'Crédit Trillium ON — volet impôts fonciers') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_05', 'deduction', 'childcare', 'Frais de garde d''enfants (ON)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_06', 'credit', 'medical', 'Frais médicaux — aînés (ON)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_07', 'credit', 'other_credits', 'Contributions politiques provinciales (ON)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bc_04', 'credit', 'other_credits', 'Contributions politiques provinciales (BC)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('ab_01', 'credit', 'other_credits', 'Contributions politiques provinciales (AB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('ab_02', 'credit', 'donations', 'Dons de bienfaisance (AB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('sk_03', 'credit', 'other_credits', 'Rénovation domiciliaire (SK)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('sk_04', 'credit', 'other_credits', 'Activités sportives/culturelles des enfants (SK)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('sk_05', 'credit', 'medical', 'Traitement de fertilité (SK)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('mb_04', 'credit', 'medical', 'Traitement de fertilité (MB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nb_01', 'credit', 'other_credits', 'Contributions politiques provinciales (NB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nb_03', 'credit', 'other_credits', 'Investissement petite entreprise (NB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('ns_02', 'credit', 'other_credits', 'Contributions politiques provinciales (NS)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('pe_01', 'credit', 'other_credits', 'Bien-être des enfants (PE)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('pe_04', 'credit', 'other_credits', 'Contributions politiques provinciales (PE)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nl_01', 'credit', 'other_credits', 'Chauffage au mazout (NL)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nl_03', 'deduction', 'childcare', 'Frais de garde / adoption (NL)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nl_04', 'credit', 'other_credits', 'Contributions politiques provinciales (NL)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nt_02', 'credit', 'other_credits', 'Contributions politiques territoriales (NT)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nu_05', 'credit', 'other_credits', 'Contributions politiques territoriales (NU)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('yt_02', 'credit', 'medical', 'Fertilité / maternité de substitution (YT)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('yt_03', 'credit', 'other_credits', 'Investissement entreprise admissible (YT)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('yt_05', 'credit', 'other_credits', 'Activités physiques des enfants (YT)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('yt_06', 'credit', 'other_credits', 'Frais d''adoption (YT)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('yt_07', 'credit', 'other_credits', 'Contributions politiques territoriales (YT)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br1', 't2', 'ventes_biens', 'Ventes brutes de biens (T2/GIFI)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br2', 't2', 'ventes_services', 'Ventes brutes de services (T2/GIFI)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br3', 't2', 'ventes_biens', 'Retours/rabais (réduisent les ventes)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br4', 'revenu', 'interest', 'Revenus d''intérêts (entreprise)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br5', 't2', 'subventions', 'Subventions reçues') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br6', 'revenu', 'rental', 'Revenus de location (entreprise)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br7', 't2', 'commissions', 'Commissions gagnées') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br8', 't2', 'autres_revenus', 'Autres revenus d''entreprise') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br9', 't2', 'autres_revenus', 'Créances douteuses recouvrées') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('br10', 'info', 'info', 'Chiffre d''affaires total (validation)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd1', 't2', 'publicite', 'Dépense — publicité') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd2', 't2', 'repas', 'Dépense — repas/divertissement (50 %)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd3', 't2', 'creances', 'Dépense — créances irrécouvrables') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd4', 't2', 'assurances', 'Dépense — assurances') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd5', 't2', 'interets', 'Dépense — intérêts et frais bancaires') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd6', 't2', 'taxes_permis', 'Dépense — taxes d''affaires et permis') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd7', 't2', 'entretien', 'Dépense — entretien et réparations') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd8', 't2', 'honoraires', 'Dépense — honoraires professionnels') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd9', 't2', 'loyer', 'Dépense — loyer commercial') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd10', 't2', 'fournitures', 'Dépense — fournitures de bureau') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd11', 't2', 'sous_traitants', 'Dépense — sous-traitants') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd12', 't2', 'deplacements', 'Dépense — déplacements d''affaires') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd13', 't2', 'vehicule', 'Dépense — véhicule d''entreprise') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd14', 't2', 'services_publics', 'Dépense — services publics') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd15', 't2', 'telecoms', 'Dépense — télécommunications') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd16', 't2', 'formation', 'Dépense — formation') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd17', 't2', 'salaires', 'Dépense — salaires et traitements') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd18', 't2', 'gestion', 'Dépense — frais de gestion') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd19', 't2', 'livraison', 'Dépense — livraison et transport') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd20', 't2', 'logiciels', 'Dépense — logiciels et abonnements') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bd21', 't2', 'autres_depenses', 'Dépense — autres (préciser)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bp2', 'info', 'info', 'Masse salariale brute totale') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bp4', 'cotisation', 'rrq_employeur', 'Cotisations employeur RPC/RRQ') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bp5', 'cotisation', 'ae_employeur', 'Cotisations employeur assurance-emploi') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bp6', 'cotisation', 'fss', 'Cotisation FSS (Québec)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bp7', 'cotisation', 'cnesst', 'Primes CNESST (Québec)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bp8', 't2', 'avantages', 'Avantages imposables versés') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('btx5', 'info', 'info', 'TPS/TVH perçue') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('btx6', 'info', 'info', 'TVQ perçue') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('btx7', 'info', 'info', 'CTI demandés') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('btx8', 'info', 'info', 'RTI demandés') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('btx10', 'info', 'info', 'Fournitures taxables totales') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('btx11', 'info', 'info', 'Fournitures détaxées/exonérées') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bim2', 'info', 'info', 'Acquisitions d''immobilisations (DPA)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bim5', 'info', 'info', 'Produit de disposition (immobilisations)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bim6', 'info', 'info', 'Coût en capital des biens cédés') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bim9', 'info', 'info', 'Inventaire de fin d''exercice') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bv2', 'info', 'info', 'Acomptes provisionnels versés') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('qc_e02', 't2', 'credit_provincial', 'CRIC — R-D / innovation / précommercialisation (QC)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('qc_e04', 't2', 'credit_provincial', 'Crédit équipement/logiciels (QC)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('qc_e05', 't2', 'credit_provincial', 'Crédit main-d''œuvre production de titres (QC)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('qc_e06', 't2', 'credit_provincial', 'Crédit production cinématographique/télévisuelle (QC)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('qc_e08', 't2', 'credit_provincial', 'Crédit médias écrits (QC)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_e01', 't2', 'credit_provincial', 'RS&DE (ON)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_e02', 't2', 'credit_provincial', 'R-D sous contrat — institut (ON)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_e03', 't2', 'credit_provincial', 'Production cinématographique/télévisuelle (ON)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_e04', 't2', 'credit_provincial', 'Médias numériques interactifs (ON)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_e05', 't2', 'credit_provincial', 'Biens en capital admissibles SPCC (ON)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('on_e06', 't2', 'credit_provincial', 'Bâtiment commercial/industriel (ON)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('ab_e01', 't2', 'credit_provincial', 'R-D (AB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('ab_e02', 't2', 'credit_provincial', 'Production cinématographique/télévisuelle (AB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bc_e01', 't2', 'credit_provincial', 'RS&DE (BC)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bc_e02', 't2', 'credit_provincial', 'Médias numériques interactifs (BC)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('bc_e03', 't2', 'credit_provincial', 'Production cinématographique (BC)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('sk_e01', 't2', 'credit_provincial', 'Biens de fabrication/transformation (SK)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('sk_e02', 't2', 'credit_provincial', 'Investissement investisseurs — technologies (SK)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('sk_e03', 't2', 'credit_provincial', 'Propriété intellectuelle commercialisée (SK)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('sk_e04', 't2', 'credit_provincial', 'Exploration minière (SK)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('mb_e01', 't2', 'credit_provincial', 'Biens de fabrication (MB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('mb_e02', 't2', 'credit_provincial', 'R-D (MB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('mb_e03', 't2', 'credit_provincial', 'Production cinématographique/vidéo (MB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('mb_e04', 't2', 'credit_provincial', 'Médias numériques interactifs (MB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nb_e01', 't2', 'credit_provincial', 'RS&DE (NB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nb_e02', 't2', 'credit_provincial', 'Production cinématographique/télévisuelle (NB)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('ns_e01', 't2', 'credit_provincial', 'RS&DE (NS)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('ns_e02', 't2', 'credit_provincial', 'Médias numériques (NS)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('ns_e03', 't2', 'credit_provincial', 'Animation numérique (NS)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('ns_e04', 't2', 'credit_provincial', 'Investissement PME innovante (NS)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('pe_e01', 't2', 'credit_provincial', 'Biens en capital (PE)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nl_e01', 't2', 'credit_provincial', 'RS&DE (NL)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nl_e02', 't2', 'credit_provincial', 'Production cinématographique/vidéo (NL)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nl_e03', 't2', 'credit_provincial', 'Médias numériques interactifs (NL)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nl_e04', 't2', 'credit_provincial', 'Technologies vertes (NL)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nt_e01', 'credit', 'other_credits', 'Contributions politiques territoriales (NT)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('nu_e01', 'credit', 'other_credits', 'Contributions politiques territoriales (NU)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
INSERT INTO q_entry_map (question_id, entry_kind, entry_category, notes) VALUES ('yt_e02', 'credit', 'other_credits', 'Contributions politiques territoriales (YT)') ON CONFLICT (question_id) DO UPDATE SET entry_kind=EXCLUDED.entry_kind, entry_category=EXCLUDED.entry_category, notes=EXCLUDED.notes;
--> statement-breakpoint
-- ─── q_entry_sync — Synchronisation effective par questionnaire ───
CREATE TABLE IF NOT EXISTS q_entry_sync (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES q_sessions(id) ON DELETE CASCADE,
  question_id   VARCHAR(50) NOT NULL REFERENCES q_entry_map(question_id),
  entry_id      UUID,
  amount_cents  INTEGER,
  status        VARCHAR(20) NOT NULL DEFAULT 'en_attente'
      CHECK (status IN ('en_attente','synchronise','ignore','erreur')),
  error_msg     TEXT,
  synced_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, question_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_q_entry_sync_session ON q_entry_sync(session_id);
--> statement-breakpoint
COMMENT ON TABLE q_entry_sync IS 'Lien entre une réponse du questionnaire et l\'entrée fiscale créée (income_entries / deduction_entries / credit_entries). entry_id = UUID de l\'entrée une fois créée.';
--> statement-breakpoint
COMMENT ON COLUMN q_entry_sync.amount_cents IS 'Montant en CENTS au moment de la synchronisation.';
--> statement-breakpoint
-- ─── q_answer_history — Audit des réponses (qui a changé quoi, quand) ───
CREATE TABLE IF NOT EXISTS q_answer_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES q_sessions(id) ON DELETE CASCADE,
  table_name    VARCHAR(60) NOT NULL,
  question_id   VARCHAR(50) NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  changed_by    VARCHAR(255),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_q_answer_history_session ON q_answer_history(session_id, changed_at);
--> statement-breakpoint
COMMENT ON TABLE q_answer_history IS 'Historique des modifications de réponses (avant/après en texte).';
--> statement-breakpoint
-- ─── Vue : réponses synchronisées avec leurs entrées fiscales ───
CREATE OR REPLACE VIEW v_questionnaire_entries AS
SELECT s.id AS session_id, s.user_id, s.questionnaire_type, s.province,
       m.question_id, m.entry_kind, m.entry_category,
       y.amount_cents, y.status, y.entry_id, y.synced_at, m.notes
FROM q_entry_sync y
JOIN q_sessions s ON s.id = y.session_id
JOIN q_entry_map m ON m.question_id = y.question_id;
--> statement-breakpoint
COMMENT ON VIEW v_questionnaire_entries IS 'Suivi de la synchronisation questionnaire → entrées fiscales, par session.';
