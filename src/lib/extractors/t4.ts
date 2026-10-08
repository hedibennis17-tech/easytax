import type { DocumentExtractor, ExtractionResult, ExtractedField } from "./base";
import { parseMontantOCR } from "@/lib/ocr/dictionnaire";
import { extractYear } from "./base";

/**
 * T4Extractor — Cases officielles de l'ARC
 * Référence : https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications/rc4120.html
 */
export class T4Extractor implements DocumentExtractor {
  readonly documentTypeCode = "T4";

  canHandle(ocrText: string): boolean {
    const t = ocrText.toUpperCase();
    return (
      (t.includes("T4") && t.includes("REMUNERATION")) ||
      (t.includes("T4") && t.includes("RÉMUNÉRATION")) ||
      (t.includes("BOX 14") || t.includes("CASE 14"))
    );
  }

  /**
   * Tente d'extraire une valeur depuis les champs structurés Google Document AI
   * avant de tomber sur les regex (texte brut).
   * Les champs structurés sont injectés dans ocrText sous forme "nom: valeur"
   */
  private extractFromStructured(
    ocrText: string,
    boxNumber: string,
    keywords: string[]
  ): string | null {
    // Chercher dans la section STRUCTURED FIELDS d'abord
    const structStart = ocrText.indexOf("--- STRUCTURED FIELDS ---");
    const structText  = structStart >= 0 ? ocrText.slice(structStart) : "";

    // Patterns pour les entities Google (type = "box_14", "14", "Box 14"...)
    const boxPatterns = [
      new RegExp("box[_\\s-]?" + boxNumber + ":[\\s]*([\\d,. ]+)", "i"),
      new RegExp("case[_\\s-]?" + boxNumber + ":[\\s]*([\\d,. ]+)", "i"),
      new RegExp("^" + boxNumber + ":[\\s]*([\\d,. ]+)", "im"),
    ];

    for (const pat of boxPatterns) {
      const m = structText.match(pat) ?? ocrText.match(pat);
      if (m?.[1]) {
        const raw = m[1].trim();
        // Nettoyer la valeur: si elle contient plus de 2 décimales (ex: "1482,6216" = montant + code case collé),
        // tronquer à 2 décimales (ex: "1482,62").
        const cleaned = raw.replace(/^([0-9\s,.']+[.,]\d{2})\d+$/, "$1");
        if (parseMontantOCR(cleaned) !== null) return cleaned;
        // Essayer la valeur brute au cas où elle est déjà valide
        if (parseMontantOCR(raw) !== null) return raw;
      }
    }

    // Chercher par keywords
    for (const kw of keywords) {
      const kwEsc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const kwPat = new RegExp(`${kwEsc}[:\\s]+([\\d,. ]+)`, "i");
      const m = structText.match(kwPat) ?? ocrText.match(kwPat);
      if (m?.[1]) {
        const raw = m[1].trim();
        const cleaned = raw.replace(/^([0-9\s,.']+[.,]\d{2})\d+$/, "$1");
        if (parseMontantOCR(cleaned) !== null) return cleaned;
        if (parseMontantOCR(raw) !== null) return raw;
      }
    }
    return null;
  }

  extract(ocrText: string, taxYear?: number): ExtractionResult {
    const fields: ExtractedField[] = [];
    const detectedYear = extractYear(ocrText) ?? taxYear ?? null;

    // ── Cases principales T4 ──────────────────────────────────────────────
    const extractions: Array<{
      code: string;
      label: string;
      patterns: RegExp[];
      required: boolean;
    }> = [
      {
        code: "box_14",
        label: "Case 14 — Revenus d'emploi",
        patterns: [
          /box\s*14[:\s-]+([0-9,.\s]+)/i,
          /case\s*14[:\s-]+([0-9,.\s]+)/i,
          /employment\s+income[:\s]+([0-9,.\s]+)/i,
          /revenus?\s+d['']?emploi[:\s]+([0-9,.\s]+)/i,
        ],
        required: true,
      },
      {
        code: "box_16",
        label: "Case 16 — Cotisations de l'employé au RPC/RRQ",
        patterns: [
          /box\s*16[:\s-]+([0-9,.\s]+)/i,
          /case\s*16[:\s-]+([0-9,.\s]+)/i,
          /cpp\s+contributions[:\s]+([0-9,.\s]+)/i,
          /cotisations?\s+rrq[:\s]+([0-9,.\s]+)/i,
        ],
        required: false,
      },
      {
        code: "box_18",
        label: "Case 18 — Cotisations de l'employé à l'AE",
        patterns: [
          /box\s*18[:\s-]+([0-9,.\s]+)/i,
          /case\s*18[:\s-]+([0-9,.\s]+)/i,
          /ei\s+premiums[:\s]+([0-9,.\s]+)/i,
          /cotisations?\s+.*ae[:\s]+([0-9,.\s]+)/i,
        ],
        required: false,
      },
      {
        code: "box_22",
        label: "Case 22 — Impôt sur le revenu retenu",
        patterns: [
          /box\s*22[:\s-]+([0-9,.\s]+)/i,
          /case\s*22[:\s-]+([0-9,.\s]+)/i,
          /income\s+tax\s+deducted[:\s]+([0-9,.\s]+)/i,
          /imp[oô]t.*retenu[:\s]+([0-9,.\s]+)/i,
        ],
        required: true,
      },
      {
        code: "box_24",
        label: "Case 24 — Gains assurables aux fins de l'AE",
        patterns: [
          /box\s*24[:\s-]+([0-9,.\s]+)/i,
          /case\s*24[:\s-]+([0-9,.\s]+)/i,
          /ei\s+insurable\s+earnings[:\s]+([0-9,.\s]+)/i,
        ],
        required: false,
      },
      {
        code: "box_26",
        label: "Case 26 — Gains ouvrant droit à pension au RPC/RRQ",
        patterns: [
          /box\s*26[:\s-]+([0-9,.\s]+)/i,
          /case\s*26[:\s-]+([0-9,.\s]+)/i,
          /cpp.*pensionable\s+earnings[:\s]+([0-9,.\s]+)/i,
        ],
        required: false,
      },
      {
        code: "box_44",
        label: "Case 44 — Cotisations syndicales",
        patterns: [
          /box\s*44[:\s-]+([0-9,.\s]+)/i,
          /case\s*44[:\s-]+([0-9,.\s]+)/i,
          /union\s+dues[:\s]+([0-9,.\s]+)/i,
          /cotisations?\s+syndicales?[:\s]+([0-9,.\s]+)/i,
        ],
        required: false,
      },
      {
        code: "box_46",
        label: "Case 46 — Dons de bienfaisance",
        patterns: [
          /box\s*46[:\s-]+([0-9,.\s]+)/i,
          /case\s*46[:\s-]+([0-9,.\s]+)/i,
          /charitable\s+donations?[:\s]+([0-9,.\s]+)/i,
          /dons?\s+de\s+bienfaisance[:\s]+([0-9,.\s]+)/i,
        ],
        required: false,
      },
      {
        code: "box_52",
        label: "Case 52 — Facteur d'équivalence",
        patterns: [
          /box\s*52[:\s-]+([0-9,.\s]+)/i,
          /case\s*52[:\s-]+([0-9,.\s]+)/i,
          /pension\s+adjustment[:\s]+([0-9,.\s]+)/i,
          /facteur\s+d['']équivalence[:\s]+([0-9,.\s]+)/i,
        ],
        required: false,
      },
    ];

    // ── Champs textuels ───────────────────────────────────────────────────
    const textFields: Array<{
      code: string;
      label: string;
      patterns: RegExp[];
      required: boolean;
    }> = [
      {
        code: "employer_name",
        label: "Nom de l'employeur",
        patterns: [
          /employer['']?s?\s+name[:\s]+([A-Z][A-Za-z0-9\s.,&'-]+?)(?:\n|address|adresse)/i,
          /nom.*employeur[:\s]+([A-Z][A-Za-z0-9\s.,&'-]+?)(?:\n)/i,
        ],
        required: true,
      },
      {
        code: "province_of_employment",
        label: "Province d'emploi",
        patterns: [
          /province\s+of\s+employment[:\s]+([A-Z]{2})/i,
          /province\s+d['']?emploi[:\s]+([A-Z]{2})/i,
        ],
        required: false,
      },
    ];

    // ── Extraire les montants (structured fields en priorité) ────────────
    for (const field of extractions) {
      let rawValue: string | null = null;
      let confidence = 0;

      // 1. Extraction structurée Google Document AI (entities + formFields)
      const boxNum = field.code.replace("box_", "");
      const kwList: string[] = [];
      for (const p of field.patterns) {
        const src = p.source;
        // Extraire les keywords non-box/case pour la recherche sémantique
        if (!src.startsWith("box") && !src.startsWith("case")) {
          kwList.push(src.split("[:\\\\s]")[0].replace(/[/\\]/g, "").trim());
        }
      }
      const structured = this.extractFromStructured(ocrText, boxNum, kwList);
      if (structured) {
        rawValue = structured;
        confidence = 92; // haute confiance Google
      }

      // 2. Fallback regex sur le texte brut (inclut le bloc STRUCTURED FIELDS enrichi)
      if (!rawValue) {
        for (const pattern of field.patterns) {
          const match = ocrText.match(pattern);
          if (match?.[1]) {
            rawValue = match[1].trim().replace(/\s+/g, "");
            confidence = 75;
            break;
          }
        }
      }

      fields.push({
        fieldCode: field.code,
        fieldLabel: field.label,
        rawOcrValue: rawValue,
        confidence: rawValue ? confidence : 0,
        needsReview: !rawValue || confidence < 70,
        isRequired: field.required,
        pageNumber: 1,
      });
    }

    // ── Extraire les champs textuels ──────────────────────────────────────
    for (const field of textFields) {
      let rawValue: string | null = null;
      let confidence = 0;

      for (const pattern of field.patterns) {
        const match = ocrText.match(pattern);
        if (match?.[1]) {
          rawValue = match[1].trim();
          confidence = 82;
          break;
        }
      }

      fields.push({
        fieldCode: field.code,
        fieldLabel: field.label,
        rawOcrValue: rawValue,
        confidence: rawValue ? confidence : 0,
        needsReview: !rawValue || confidence < 70,
        isRequired: field.required,
        pageNumber: 1,
      });
    }

    // ── Calcul confiance globale ──────────────────────────────────────────
    const extractedFields = fields.filter((f) => f.rawOcrValue !== null);
    const overallConfidence =
      extractedFields.length > 0
        ? Math.round(
            extractedFields.reduce((sum, f) => sum + f.confidence, 0) /
              extractedFields.length
          )
        : 0;

    const needsHumanReview =
      overallConfidence < 75 ||
      fields.filter((f) => f.isRequired && !f.rawOcrValue).length > 0;

    // ── Avertissement année ───────────────────────────────────────────────
    const yearMismatchWarning =
      detectedYear !== null && taxYear !== undefined && detectedYear !== taxYear;

    // ── Province d'emploi ─────────────────────────────────────────────────
    const provinceField = fields.find((f) => f.fieldCode === "province_of_employment");
    const detectedJurisdictionCode = provinceField?.rawOcrValue ?? null;

    return {
      fields,
      overallConfidence,
      needsHumanReview,
      yearMismatchWarning,
      detectedTaxYear: detectedYear,
      detectedJurisdictionCode,
    };
  }
}

// Registre des extracteurs
// T4Extractor: extracteur spécialisé avec patterns hardcodés (haute confiance)
// T5007_EXTRACTOR: extracteur zone-based BOXES_ONLY (architecture v2)
// UNIVERSAL_EXTRACTORS: extracteur dictionnaire pour les autres feuillets
import { UNIVERSAL_EXTRACTORS } from "./universal";
import { T5007_EXTRACTOR } from "./t5007";

export const EXTRACTORS: DocumentExtractor[] = [
  new T4Extractor(),    // Extracteur spécialisé T4
  T5007_EXTRACTOR,      // Extracteur zone-based T5007 (EXTRACT_BOXES_ONLY)
  ...UNIVERSAL_EXTRACTORS, // Extracteurs universels pour T4A, T4E, T5, RL-1, RL-2... (27 feuillets)
];

export function getExtractor(documentTypeCode: string): DocumentExtractor | null {
  // Priorité: extracteur spécialisé > extracteur universel
  return EXTRACTORS.find((e) => e.documentTypeCode === documentTypeCode) ?? null;
}
