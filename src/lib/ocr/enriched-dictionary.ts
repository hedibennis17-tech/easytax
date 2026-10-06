import suppliedDictionary from "./universal-canadian-tax-ocr-dictionary-v2-2025.json";

/**
 * Couche d’enrichissement du dictionnaire OCR.
 *
 * Le fichier fourni est conservé tel quel dans le projet, puis fusionné avec le
 * dictionnaire fiscal historique qui reste la source de compatibilité des lignes
 * T1/TP-1. Ainsi, les 28 feuillets actifs reçoivent leurs alias, concepts
 * sémantiques, règles de validation et provenance sans modifier les mappings
 * fiscaux déjà vérifiés.
 */

type SuppliedBox = {
  code?: string;
  keywords_fr?: string[];
  keywords_en?: string[];
  keywordsFr?: string[];
  keywordsEn?: string[];
  ocrAliases?: string[];
  fieldId?: string;
  semanticConcept?: string;
  dataType?: string;
  source?: unknown;
  mapping?: unknown;
  relationships?: unknown;
  validation?: unknown;
  confidencePolicy?: unknown;
  provenanceRequired?: boolean;
  [key: string]: unknown;
};

type SuppliedSlip = {
  code?: string;
  anchors?: string[];
  boxes?: SuppliedBox[];
  documentId?: string;
  [key: string]: unknown;
};

type SuppliedDictionary = {
  meta?: { version?: string };
  documents?: Record<string, SuppliedSlip>;
  document_classifier?: { anchors?: Record<string, string[]> };
  ocr_engine?: { segmentation_rules?: string[] };
  semantic_concepts?: Record<string, unknown>;
};

type LegacyBox = {
  code: string;
  keywords_fr: string[];
  keywords_en: string[];
};

type LegacySlip = {
  code: string;
  anchors: string[];
  boxes: LegacyBox[];
};

export const SUPPLIED_OCR_DICTIONARY = suppliedDictionary as SuppliedDictionary;
export const SUPPLIED_OCR_DICTIONARY_VERSION = SUPPLIED_OCR_DICTIONARY.meta?.version ?? "v2-2025";
export const SUPPLIED_OCR_SEGMENTATION_RULES = SUPPLIED_OCR_DICTIONARY.ocr_engine?.segmentation_rules ?? [];
export const SUPPLIED_SEMANTIC_CONCEPTS = SUPPLIED_OCR_DICTIONARY.semantic_concepts ?? {};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, "");
}

function unique(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.flatMap(value => value ? [value.trim()] : []).filter(Boolean))];
}

export function getSuppliedSlip(code: string): SuppliedSlip | null {
  const target = normalizeCode(code);
  return Object.values(SUPPLIED_OCR_DICTIONARY.documents ?? {}).find(
    document => document.code && normalizeCode(document.code) === target,
  ) ?? null;
}

/**
 * Fusionne les informations supplémentaires du JSON fourni dans les 28 feuillets
 * déjà actifs. Aucun mapping T1/TP-1 existant n’est remplacé ici.
 */
export function enrichLegacySlips<T extends LegacySlip>(legacySlips: T[]): T[] {
  return legacySlips.map(legacySlip => {
    const suppliedSlip = getSuppliedSlip(legacySlip.code);
    if (!suppliedSlip) return legacySlip;

    const suppliedBoxes = new Map(
      (suppliedSlip.boxes ?? [])
        .filter((box): box is SuppliedBox & { code: string } => Boolean(box.code))
        .map(box => [normalizeCode(box.code), box]),
    );

    const boxes = legacySlip.boxes.map(legacyBox => {
      const suppliedBox = suppliedBoxes.get(normalizeCode(legacyBox.code));
      if (!suppliedBox) return legacyBox;

      return {
        ...legacyBox,
        // Préserver les champs historiques, enrichir les recherches OCR.
        keywords_fr: unique([
          ...legacyBox.keywords_fr,
          ...(suppliedBox.keywords_fr ?? []),
          ...(suppliedBox.keywordsFr ?? []),
        ]),
        keywords_en: unique([
          ...legacyBox.keywords_en,
          ...(suppliedBox.keywords_en ?? []),
          ...(suppliedBox.keywordsEn ?? []),
        ]),
        ocrAliases: unique([
          legacyBox.code,
          `case ${legacyBox.code}`,
          `box ${legacyBox.code}`,
          ...(suppliedBox.ocrAliases ?? []),
        ]),
        fieldId: suppliedBox.fieldId,
        semanticConcept: suppliedBox.semanticConcept,
        dataType: suppliedBox.dataType,
        source: suppliedBox.source,
        mapping: suppliedBox.mapping,
        relationships: suppliedBox.relationships,
        validation: suppliedBox.validation,
        confidencePolicy: suppliedBox.confidencePolicy,
        provenanceRequired: suppliedBox.provenanceRequired,
      };
    });

    return {
      ...legacySlip,
      anchors: unique([
        ...legacySlip.anchors,
        ...(suppliedSlip.anchors ?? []),
        ...(SUPPLIED_OCR_DICTIONARY.document_classifier?.anchors?.[legacySlip.code] ?? []),
      ]),
      boxes,
      suppliedDocumentId: suppliedSlip.documentId ?? null,
      suppliedDictionaryVersion: SUPPLIED_OCR_DICTIONARY_VERSION,
    } as T;
  });
}
