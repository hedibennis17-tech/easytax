import catalogData from "./pan-canadian-document-intelligence.v2.json";

export type CatalogDocumentType = {
  code: string;
  name: string;
  authority: string;
  jurisdictions: string[];
  family: string;
  is_information_slip: boolean;
  classification: {
    anchors: string[];
    hard_type_check: boolean;
  };
};

export type CatalogMatchState = "confirmed" | "candidate" | "unknown";

export type CatalogClassification = {
  documentTypeCode: string | null;
  confidence: number;
  reason: string;
  state: CatalogMatchState;
  document: CatalogDocumentType | null;
  detectedJurisdictionCode: string | null;
  detectedTaxYear: number | null;
};

export type TypeGuardResult = {
  accepted: boolean;
  action: "ACCEPT" | "REJECT";
  reason: string;
  suggestedTypeCode: string | null;
};

type Catalog = {
  version: string;
  document_registry: CatalogDocumentType[];
  jurisdictions: Record<string, string>;
};

export const DOCUMENT_INTELLIGENCE_CATALOG = catalogData as Catalog;
export const DOCUMENT_CATALOG_VERSION = DOCUMENT_INTELLIGENCE_CATALOG.version;
export const CATALOG_DOCUMENT_TYPES = DOCUMENT_INTELLIGENCE_CATALOG.document_registry;

const FRENCH_ANCHORS: Record<string, string[]> = {
  T3: ["Revenus de fiducie"],
  T4: ["État de la rémunération payée", "Etat de la remuneration payee"],
  T4A: ["État du revenu de pension", "Etat du revenu de pension", "Pension retraite rente"],
  T4E: ["État des prestations d'assurance-emploi", "Etat des prestations d'assurance-emploi"],
  T4RIF: ["État de revenu d'un fonds enregistré de revenu de retraite"],
  T4RSP: ["État de revenu REER", "Etat de revenu REER"],
  T5: ["État des revenus de placements", "Etat des revenus de placements"],
  T5007: ["État des prestations", "Etat des prestations"],
  T5008: ["État des opérations sur titres", "Etat des operations sur titres"],
  T2202: ["Certificat pour frais de scolarité et d'inscription", "Certificat pour frais de scolarite et d'inscription"],
  RRSP_RECEIPT: ["Reçu de cotisation REER", "Recu de cotisation REER"],
  PRPP_RECEIPT: ["Reçu de cotisation à un régime de pension agréé collectif", "Recu de cotisation a un regime de pension agree collectif"],
};

const FRENCH_LABELS: Record<string, string> = {
  T3: "Revenus de fiducie",
  T4: "Rémunération payée",
  T4A: "Pension, retraite, rente et autres revenus",
  T4E: "Assurance-emploi et autres prestations",
  T4RIF: "Revenu d'un FERR",
  T4RSP: "Revenu d'un REER",
  T5: "Revenus de placements",
  T5007: "Prestations",
  T5008: "Opérations sur titres",
  T2202: "Frais de scolarité et inscription",
  RRSP_RECEIPT: "Reçu de cotisation REER",
  PRPP_RECEIPT: "Reçu de cotisation RPAC",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeForToken(value: string): string {
  return normalize(value)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/[\s/_-]+/g, "[^A-Z0-9]*");
}

function hasToken(text: string, token: string): boolean {
  const tokenPattern = escapeForToken(token);
  return new RegExp(`(?:^|[^A-Z0-9])${tokenPattern}(?=$|[^A-Z0-9])`, "i").test(text);
}

function extractTaxYear(text: string): number | null {
  const match = text.match(/\b(20(?:1[8-9]|2\d|30))\b/);
  return match ? Number(match[1]) : null;
}

function preferredFrenchLabel(document: CatalogDocumentType): string {
  return FRENCH_LABELS[document.code] ?? document.name;
}

export function getCatalogDocumentType(code: string | null | undefined): CatalogDocumentType | null {
  if (!code) return null;
  const normalizedCode = normalize(code);
  return CATALOG_DOCUMENT_TYPES.find(document => normalize(document.code) === normalizedCode) ?? null;
}

export function isCatalogDocumentType(code: string | null | undefined): boolean {
  return Boolean(getCatalogDocumentType(code));
}

export function catalogDocumentLabelFr(code: string): string {
  const document = getCatalogDocumentType(code);
  return document ? `${document.code} — ${preferredFrenchLabel(document)}` : code;
}

export function catalogDocumentLabelEn(code: string): string {
  const document = getCatalogDocumentType(code);
  return document ? `${document.code} — ${document.name}` : code;
}

/**
 * Classe le feuillet selon le référentiel EasyTax v2.0.
 * « confirmed » exige le code exact ET un ancrage sémantique de la classe.
 * Un code seul reste une candidature : l'OCR peut avoir lu une référence à un
 * autre feuillet dans une instruction ou une annexe.
 */
export function classifyTaxDocument(ocrText: string): CatalogClassification {
  const text = normalize(ocrText);
  const candidates = CATALOG_DOCUMENT_TYPES
    .map(document => {
      const anchors = [...document.classification.anchors, ...(FRENCH_ANCHORS[document.code] ?? [])];
      const codeHit = hasToken(text, document.code);
      const semanticHits = anchors
        .filter(anchor => normalize(anchor) !== normalize(document.code))
        .filter(anchor => hasToken(text, anchor));
      const semanticHit = semanticHits.length > 0;
      const score = codeHit && semanticHit ? 100 : codeHit ? 91 : semanticHit ? 86 : 0;
      return { document, codeHit, semanticHits, semanticHit, score };
    })
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return right.document.code.length - left.document.code.length;
    });

  const best = candidates[0];
  const detectedTaxYear = extractTaxYear(text);
  if (!best) {
    return {
      documentTypeCode: null,
      confidence: 0,
      reason: "Type fiscal non prouvé par le catalogue pancanadien EasyTax v2.0.",
      state: "unknown",
      document: null,
      detectedJurisdictionCode: null,
      detectedTaxYear,
    };
  }

  const isConfirmed = best.codeHit && best.semanticHit;
  const jurisdiction = best.document.jurisdictions.length === 1 ? best.document.jurisdictions[0] ?? null : "CA";
  return {
    documentTypeCode: best.document.code,
    confidence: best.score,
    reason: isConfirmed
      ? `${best.document.code} prouvé par le code du feuillet et l'ancrage « ${best.semanticHits[0]} » du catalogue v${DOCUMENT_CATALOG_VERSION}.`
      : `${best.document.code} seulement suggéré : un seul ancrage a été trouvé. Une confirmation supplémentaire est nécessaire.`,
    state: isConfirmed ? "confirmed" : "candidate",
    document: best.document,
    detectedJurisdictionCode: jurisdiction,
    detectedTaxYear,
  };
}

/**
 * Applique la règle métier fondamentale : une contradiction entre le type de
 * téléversement et le type prouvé ne peut jamais alimenter Tax Engine.
 */
export function guardSelectedDocumentType(
  selectedTypeCode: string | null | undefined,
  classification: CatalogClassification,
): TypeGuardResult {
  const selected = normalize(selectedTypeCode ?? "OTHER");
  const smartMode = selected === "AUTO" || selected === "OTHER" || !selected;

  if (classification.state !== "confirmed" || !classification.documentTypeCode) {
    return {
      accepted: false,
      action: "REJECT",
      reason: "Le type du document n’a pas été prouvé par le code et les ancrages requis. Aucune donnée fiscale ne sera injectée.",
      suggestedTypeCode: classification.documentTypeCode,
    };
  }

  if (!smartMode && selected !== normalize(classification.documentTypeCode)) {
    return {
      accepted: false,
      action: "REJECT",
      reason: `Type contradictoire : le téléversement indiquait ${selectedTypeCode}, mais EasyTax a prouvé ${classification.documentTypeCode}. Le document est conservé, sans injection fiscale.`,
      suggestedTypeCode: classification.documentTypeCode,
    };
  }

  return {
    accepted: true,
    action: "ACCEPT",
    reason: smartMode
      ? `${classification.documentTypeCode} détecté et prouvé automatiquement.`
      : `${classification.documentTypeCode} confirmé avec succès.`,
    suggestedTypeCode: classification.documentTypeCode,
  };
}
