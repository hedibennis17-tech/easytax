-- ═══════════════════════════════════════════════════════════════
-- Migration 0008 — Données fiscales 2025 complètes
-- 14 juridictions (fédéral + 13 provinces/territoires)
-- Sources: ARC T4032 2025, budgets provinciaux 2025
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. S'assurer que l'année 2025 existe ────────────────────
INSERT INTO tax_years (id, year, status, filing_deadline_federal, filing_deadline_quebec)
VALUES (gen_random_uuid(), 2025, 'open', '2026-04-30', '2026-04-30')
ON CONFLICT (year) DO NOTHING;

-- ─── 2. Juridictions ─────────────────────────────────────────
INSERT INTO jurisdictions (id, code, country_code, name_fr, name_en, jurisdiction_level, tax_administration, has_provincial_return, is_active)
VALUES
  (gen_random_uuid(), 'CA', 'CA', 'Fédéral',                    'Federal',                    'federal',     'CRA',                    false, true),
  (gen_random_uuid(), 'QC', 'CA', 'Québec',                     'Quebec',                     'provincial',  'REVENU_QUEBEC',           true,  true),
  (gen_random_uuid(), 'ON', 'CA', 'Ontario',                    'Ontario',                    'provincial',  'CRA',                    true,  true),
  (gen_random_uuid(), 'AB', 'CA', 'Alberta',                    'Alberta',                    'provincial',  'CRA',                    true,  true),
  (gen_random_uuid(), 'BC', 'CA', 'Colombie-Britannique',       'British Columbia',           'provincial',  'CRA',                    true,  true),
  (gen_random_uuid(), 'SK', 'CA', 'Saskatchewan',              'Saskatchewan',              'provincial',  'CRA',                    true,  true),
  (gen_random_uuid(), 'MB', 'CA', 'Manitoba',                   'Manitoba',                   'provincial',  'CRA',                    true,  true),
  (gen_random_uuid(), 'NB', 'CA', 'Nouveau-Brunswick',          'New Brunswick',              'provincial',  'CRA',                    true,  true),
  (gen_random_uuid(), 'NS', 'CA', 'Nouvelle-Écosse',            'Nova Scotia',                'provincial',  'CRA',                    true,  true),
  (gen_random_uuid(), 'PE', 'CA', 'Île-du-Prince-Édouard',      'Prince Edward Island',       'provincial',  'CRA',                    true,  true),
  (gen_random_uuid(), 'NL', 'CA', 'Terre-Neuve-et-Labrador',   'Newfoundland and Labrador',  'provincial',  'CRA',                    true,  true),
  (gen_random_uuid(), 'NT', 'CA', 'Territoires du Nord-Ouest', 'Northwest Territories',      'territorial', 'CRA',                    true,  true),
  (gen_random_uuid(), 'NU', 'CA', 'Nunavut',                    'Nunavut',                    'territorial', 'CRA',                    true,  true),
  (gen_random_uuid(), 'YT', 'CA', 'Yukon',                      'Yukon',                      'territorial', 'CRA',                    true,  true)
ON CONFLICT (code) DO UPDATE SET
  name_fr = EXCLUDED.name_fr,
  name_en = EXCLUDED.name_en,
  tax_administration = EXCLUDED.tax_administration,
  has_provincial_return = EXCLUDED.has_provincial_return,
  updated_at = now();

-- ─── 3. Deadlines par juridiction pour 2025 ──────────────────
INSERT INTO jurisdiction_tax_year_rules (id, jurisdiction_id, tax_year_id, filing_deadline, payment_deadline, rules_version, notes)
SELECT
  gen_random_uuid(),
  j.id,
  ty.id,
  '2026-04-30',
  '2026-04-30',
  '2025.v2.0',
  j.code || ' — règles fiscales 2025'
FROM jurisdictions j
CROSS JOIN tax_years ty
WHERE ty.year = 2025
ON CONFLICT DO NOTHING;

-- ─── 4. Règles fiscales (tax_rules) par province ─────────────
-- Format: rule_type, rule_code, amount_cents, rate_basis_points

-- === FÉDÉRAL (CA) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, min_amount_cents, threshold_cents, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, min_cents, threshold_cents, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'CA_BPA_2025',       'Montant personnel de base fédéral', 'Federal basic personal amount', 1612900, 0, 1453800, 17788200),
  ('income_bracket',        'CA_BRACKET_1_2025', 'Palier 1 — jusqu''à 57 375$',       'Bracket 1 — up to $57,375',      5737500, 1500, 0, 5737500),
  ('income_bracket',        'CA_BRACKET_2_2025', 'Palier 2 — 57 375$ à 114 750$',     'Bracket 2',                      11475000, 2050, 5737500, 11475000),
  ('income_bracket',        'CA_BRACKET_3_2025', 'Palier 3 — 114 750$ à 158 519$',    'Bracket 3',                      15851900, 2600, 11475000, 15851900),
  ('income_bracket',        'CA_BRACKET_4_2025', 'Palier 4 — 158 519$ à 220 000$',    'Bracket 4',                      22000000, 2900, 15851900, 22000000),
  ('income_bracket',        'CA_BRACKET_5_2025', 'Palier 5 — 220 000$ et plus',        'Bracket 5',                      0, 3300, 22000000, NULL)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, min_cents, threshold_cents)
WHERE j.code = 'CA' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === QUÉBEC (QC) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'QC_BPA_2025',        'Montant personnel de base QC',  'QC basic personal amount', 1718300, 0),
  ('income_bracket',        'QC_BRACKET_1_2025',  'Palier QC 1 — 0 à 51 780$',    'QC bracket 1', 5178000, 1400),
  ('income_bracket',        'QC_BRACKET_2_2025',  'Palier QC 2 — 51 780$ à 103 545$', 'QC bracket 2', 10354500, 1900),
  ('income_bracket',        'QC_BRACKET_3_2025',  'Palier QC 3 — 103 545$ à 126 000$', 'QC bracket 3', 12600000, 2400),
  ('income_bracket',        'QC_BRACKET_4_2025',  'Palier QC 4 — 126 000$ et +',   'QC bracket 4', 0, 2575),
  ('provincial_credit',     'QC_SOLIDARITY_2025', 'Crédit solidarité — composante TVQ', 'Solidarity credit — QST component', 36200, 0),
  ('filing_deadline',       'QC_DEADLINE_2025',   'Date limite TP-1 2025',          'TP-1 2025 deadline', 0, 0)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'QC' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === ONTARIO (ON) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'ON_BPA_2025',       'Montant personnel de base ON', 'ON basic personal amount', 1114100, 0),
  ('income_bracket',        'ON_BRACKET_1_2025', 'Palier ON 1 — 0 à 51 446$',   'ON bracket 1', 5144600, 505),
  ('income_bracket',        'ON_BRACKET_2_2025', 'Palier ON 2',                  'ON bracket 2', 10289400, 915),
  ('income_bracket',        'ON_BRACKET_3_2025', 'Palier ON 3',                  'ON bracket 3', 15000000, 1116),
  ('income_bracket',        'ON_BRACKET_4_2025', 'Palier ON 4',                  'ON bracket 4', 22000000, 1216),
  ('income_bracket',        'ON_BRACKET_5_2025', 'Palier ON 5 — 220 000$ et +', 'ON bracket 5', 0, 1316),
  ('surtax',                'ON_SURTAX_1_2025',  'Surtaxe ON 20% — impôt > 5 315$', 'ON surtax 20%', 531500, 2000),
  ('surtax',                'ON_SURTAX_2_2025',  'Surtaxe ON 36% — impôt > 6 802$', 'ON surtax 36%', 680200, 3600),
  ('provincial_credit',     'ON_TRILLIUM_2025',  'Prestation Trillium (OSTC base)', 'Ontario Trillium Benefit', 15800, 0)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'ON' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === ALBERTA (AB) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'AB_BPA_2025',       'Montant personnel de base AB (le plus élevé)', 'AB basic personal amount (highest)',  2232300, 0),
  ('income_bracket',        'AB_BRACKET_1_2025', 'Palier AB 1 — 0 à 60 000$ (NOUVEAU 2025)',     'AB bracket 1 — new 2025',             6000000,  800),
  ('income_bracket',        'AB_BRACKET_2_2025', 'Palier AB 2 — 60 000$ à 148 269$',             'AB bracket 2',                       14826900, 1000),
  ('income_bracket',        'AB_BRACKET_3_2025', 'Palier AB 3 — 148 269$ à 177 922$',            'AB bracket 3',                       17792200, 1200),
  ('income_bracket',        'AB_BRACKET_4_2025', 'Palier AB 4 — 177 922$ à 237 230$',            'AB bracket 4',                       23723000, 1300),
  ('income_bracket',        'AB_BRACKET_5_2025', 'Palier AB 5 — 237 230$ à 355 845$',            'AB bracket 5',                       35584500, 1400),
  ('income_bracket',        'AB_BRACKET_6_2025', 'Palier AB 6 — 355 845$ et +',                  'AB bracket 6',                       0, 1500)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'AB' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === COLOMBIE-BRITANNIQUE (BC) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'BC_BPA_2025',       'Montant personnel de base C.-B.', 'BC basic personal amount', 1293200, 0),
  ('income_bracket',        'BC_BRACKET_1_2025', 'Palier BC 1 — 0 à 45 654$',      'BC bracket 1',              4565400,  506),
  ('income_bracket',        'BC_BRACKET_2_2025', 'Palier BC 2',                     'BC bracket 2',              9131000,  770),
  ('income_bracket',        'BC_BRACKET_3_2025', 'Palier BC 3',                     'BC bracket 3',             10483500, 1050),
  ('income_bracket',        'BC_BRACKET_4_2025', 'Palier BC 4',                     'BC bracket 4',             12729900, 1229),
  ('income_bracket',        'BC_BRACKET_5_2025', 'Palier BC 5',                     'BC bracket 5',             17260200, 1470),
  ('income_bracket',        'BC_BRACKET_6_2025', 'Palier BC 6',                     'BC bracket 6',             24071600, 1680),
  ('income_bracket',        'BC_BRACKET_7_2025', 'Palier BC 7 — 240 716$ et +',    'BC bracket 7',                     0, 2050)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'BC' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === SASKATCHEWAN (SK) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'SK_BPA_2025',       'Montant personnel de base SK (Affordability Act)', 'SK basic personal amount', 1949100, 0),
  ('income_bracket',        'SK_BRACKET_1_2025', 'Palier SK 1 — 0 à 49 720$',      'SK bracket 1', 4972000, 1050),
  ('income_bracket',        'SK_BRACKET_2_2025', 'Palier SK 2 — 49 720$ à 142 058$', 'SK bracket 2', 14205800, 1250),
  ('income_bracket',        'SK_BRACKET_3_2025', 'Palier SK 3 — 142 058$ et +',    'SK bracket 3', 0, 1450)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'SK' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === MANITOBA (MB) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'MB_BPA_2025',       'Montant personnel de base MB (élimination progressive 200k-400k)', 'MB basic personal amount (phase-out 200k-400k)', 1596900, 0),
  ('income_bracket',        'MB_BRACKET_1_2025', 'Palier MB 1 — 0 à 47 000$',      'MB bracket 1', 4700000, 1080),
  ('income_bracket',        'MB_BRACKET_2_2025', 'Palier MB 2 — 47 000$ à 101 200$', 'MB bracket 2', 10120000, 1275),
  ('income_bracket',        'MB_BRACKET_3_2025', 'Palier MB 3 — 101 200$ et +',    'MB bracket 3', 0, 1740),
  ('provincial_credit',     'MB_RENT_2025',      'Crédit locataires MB 575$',       'MB renters credit', 57500, 0)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'MB' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === NOUVEAU-BRUNSWICK (NB) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'NB_BPA_2025',       'Montant personnel de base NB', 'NB basic personal amount', 1339600, 0),
  ('income_bracket',        'NB_BRACKET_1_2025', 'Palier NB 1 — 0 à 47 715$',   'NB bracket 1', 4771500, 940),
  ('income_bracket',        'NB_BRACKET_2_2025', 'Palier NB 2',                  'NB bracket 2', 9543100, 1400),
  ('income_bracket',        'NB_BRACKET_3_2025', 'Palier NB 3',                  'NB bracket 3', 17675600, 1600),
  ('income_bracket',        'NB_BRACKET_4_2025', 'Palier NB 4 — 176 756$ et +', 'NB bracket 4', 0, 1950)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'NB' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === NOUVELLE-ÉCOSSE (NS) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'NS_BPA_2025',       'Montant personnel de base NS (universel 2025)', 'NS basic personal amount (universal 2025)', 1174400, 0),
  ('income_bracket',        'NS_BRACKET_1_2025', 'Palier NS 1 — 0 à 29 590$',    'NS bracket 1',  2959000,  879),
  ('income_bracket',        'NS_BRACKET_2_2025', 'Palier NS 2',                   'NS bracket 2',  5918000, 1495),
  ('income_bracket',        'NS_BRACKET_3_2025', 'Palier NS 3',                   'NS bracket 3',  9300000, 1700),
  ('income_bracket',        'NS_BRACKET_4_2025', 'Palier NS 4',                   'NS bracket 4', 15000000, 2100),
  ('income_bracket',        'NS_BRACKET_5_2025', 'Palier NS 5 — 150 000$ et +',  'NS bracket 5',         0, 2100)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'NS' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === ÎLE-DU-PRINCE-ÉDOUARD (PE) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'PE_BPA_2025',       'Montant personnel de base PE (budget 2025)', 'PE basic personal amount', 1465000, 0),
  ('income_bracket',        'PE_BRACKET_1_2025', 'Palier PE 1 — 0 à 32 656$',    'PE bracket 1',  3265600,  950),
  ('income_bracket',        'PE_BRACKET_2_2025', 'Palier PE 2',                   'PE bracket 2',  6431300, 1347),
  ('income_bracket',        'PE_BRACKET_3_2025', 'Palier PE 3',                   'PE bracket 3', 10500000, 1660),
  ('income_bracket',        'PE_BRACKET_4_2025', 'Palier PE 4',                   'PE bracket 4', 14000000, 1762),
  ('income_bracket',        'PE_BRACKET_5_2025', 'Palier PE 5 — 140 000$ et +',  'PE bracket 5',         0, 1900)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'PE' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === TERRE-NEUVE-ET-LABRADOR (NL) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'NL_BPA_2025',       'Montant personnel de base NL', 'NL basic personal amount', 1106700, 0),
  ('income_bracket',        'NL_BRACKET_1_2025', 'Palier NL 1 — 0 à 43 198$',    'NL bracket 1',   4319800,  870),
  ('income_bracket',        'NL_BRACKET_2_2025', 'Palier NL 2',                   'NL bracket 2',   8639500, 1450),
  ('income_bracket',        'NL_BRACKET_3_2025', 'Palier NL 3',                   'NL bracket 3',  15424400, 1580),
  ('income_bracket',        'NL_BRACKET_4_2025', 'Palier NL 4',                   'NL bracket 4',  21594300, 1780),
  ('income_bracket',        'NL_BRACKET_5_2025', 'Palier NL 5',                   'NL bracket 5',  27587000, 1980),
  ('income_bracket',        'NL_BRACKET_6_2025', 'Palier NL 6',                   'NL bracket 6',  55173900, 2080),
  ('income_bracket',        'NL_BRACKET_7_2025', 'Palier NL 7',                   'NL bracket 7', 110347800, 2180),
  ('income_bracket',        'NL_BRACKET_8_2025', 'Palier NL 8 — 1 103 478$ et +','NL bracket 8',          0, 2180)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'NL' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === TERRITOIRES DU NORD-OUEST (NT) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'NT_BPA_2025',       'Montant personnel de base TNO', 'NT basic personal amount', 1784200, 0),
  ('income_bracket',        'NT_BRACKET_1_2025', 'Palier NT 1 — 0 à 50 597$',    'NT bracket 1',  5059700,  590),
  ('income_bracket',        'NT_BRACKET_2_2025', 'Palier NT 2',                   'NT bracket 2', 10119800,  860),
  ('income_bracket',        'NT_BRACKET_3_2025', 'Palier NT 3',                   'NT bracket 3', 16452500, 1220),
  ('income_bracket',        'NT_BRACKET_4_2025', 'Palier NT 4 — 164 525$ et +',  'NT bracket 4',         0, 1405),
  ('provincial_credit',     'NT_COSTLIVING_2025','Crédit coût de la vie TNO 792$', 'NT Cost of Living Credit', 79200, 0)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'NT' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === NUNAVUT (NU) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'NU_BPA_2025',       'Montant personnel de base NU (le plus élevé Canada)', 'NU basic personal amount (highest in Canada)', 1927400, 0),
  ('income_bracket',        'NU_BRACKET_1_2025', 'Palier NU 1 — 0 à 53 268$',    'NU bracket 1',  5326800,  400),
  ('income_bracket',        'NU_BRACKET_2_2025', 'Palier NU 2',                   'NU bracket 2', 10653700,  700),
  ('income_bracket',        'NU_BRACKET_3_2025', 'Palier NU 3',                   'NU bracket 3', 17320500,  900),
  ('income_bracket',        'NU_BRACKET_4_2025', 'Palier NU 4 — 173 205$ et +',  'NU bracket 4',         0, 1150),
  ('provincial_credit',     'NU_VOLUNTEER_2025', 'Crédit pompiers volontaires NU (nouveau 2025)', 'NU Volunteer Firefighter Credit', 72200, 0)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'NU' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- === YUKON (YT) ===
INSERT INTO tax_rules (id, jurisdiction_id, tax_year_id, rule_type, rule_code, description_fr, description_en, amount_cents, rate_basis_points, rule_version, effective_from)
SELECT gen_random_uuid(), j.id, ty.id, rule_type::tax_rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp, '2025.v2.0', '2025-01-01'
FROM jurisdictions j, tax_years ty,
(VALUES
  ('basic_personal_amount', 'YT_BPA_2025',       'Montant personnel de base YT (= fédéral)', 'YT basic personal amount (= federal)', 1612900, 0),
  ('income_bracket',        'YT_BRACKET_1_2025', 'Palier YT 1 — 0 à 57 375$',    'YT bracket 1',  5737500,  640),
  ('income_bracket',        'YT_BRACKET_2_2025', 'Palier YT 2',                   'YT bracket 2', 11475000,  900),
  ('income_bracket',        'YT_BRACKET_3_2025', 'Palier YT 3',                   'YT bracket 3', 15851900, 1090),
  ('income_bracket',        'YT_BRACKET_4_2025', 'Palier YT 4',                   'YT bracket 4', 50000000, 1280),
  ('income_bracket',        'YT_BRACKET_5_2025', 'Palier YT 5 — 500 000$ et +',  'YT bracket 5',         0, 1500),
  ('provincial_credit',     'YT_FERTILITY_2025', 'Crédit fertilité YT 40% (nouveau 2025)', 'YT Fertility Credit 40%', 400000, 4000)
) AS t(rule_type, rule_code, desc_fr, desc_en, amount_cents, rate_bp)
WHERE j.code = 'YT' AND ty.year = 2025
ON CONFLICT DO NOTHING;

-- ─── 5. Récapitulatif ─────────────────────────────────────────
-- Vérification: 14 juridictions insérées
SELECT
  j.code,
  j.name_fr,
  j.tax_administration,
  COUNT(tr.id) AS nb_rules
FROM jurisdictions j
LEFT JOIN tax_rules tr ON tr.jurisdiction_id = j.id
GROUP BY j.code, j.name_fr, j.tax_administration
ORDER BY j.jurisdiction_level, j.code;
