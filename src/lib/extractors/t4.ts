import type { DocumentExtractor, ExtractionResult, ExtractedField } from "./base";
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

    // ── Extraire les montants ─────────────────────────────────────────────
    for (const field of extractions) {
      let rawValue: string | null = null;
      let confidence = 0;

      for (const pattern of field.patterns) {
        const match = ocrText.match(pattern);
        if (match?.[1]) {
          rawValue = match[1].trim().replace(/\s+/g, "");
          confidence = 88; // confiance de base pour extraction par regex
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

// Registre des extracteurs — ajouter RL-1, T4A, T5 ici plus tard
export const EXTRACTORS: DocumentExtractor[] = [new T4Extractor()];

export function getExtractor(documentTypeCode: string): DocumentExtractor | null {
  return EXTRACTORS.find((e) => e.documentTypeCode === documentTypeCode) ?? null;
}
