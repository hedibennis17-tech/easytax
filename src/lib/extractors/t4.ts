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
          /(?:box|case)\s*14\b[^\d]{0,80}([0-9][0-9\s,.\u00a0]{0,20})/i,
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
          /(?:box|case)\s*16\b[^\d]{0,80}([0-9][0-9\s,.\u00a0]{0,20})/i,
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
          /(?:box|case)\s*18\b[^\d]{0,80}([0-9][0-9\s,.\u00a0]{0,20})/i,
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
          /(?:box|case)\s*22\b[^\d]{0,80}([0-9][0-9\s,.\u00a0]{0,20})/i,
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
          /(?:box|case)\s*24\b[^\d]{0,80}([0-9][0-9\s,.\u00a0]{0,20})/i,
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
          /(?:box|case)\s*26\b[^\d]{0,80}([0-9][0-9\s,.\u00a0]{0,20})/i,
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
          /(?:box|case)\s*44\b[^\d]{0,80}([0-9][0-9\s,.\u00a0]{0,20})/i,
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
          /(?:box|case)\s*46\b[^\d]{0,80}([0-9][0-9\s,.\u00a0]{0,20})/i,
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
          /(?:box|case)\s*52\b[^\d]{0,80}([0-9][0-9\s,.\u00a0]{0,20})/i,
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

/**
 * T4AExtractor — État du revenu de pension, de retraite, de rente ou d'autres
 * sources de revenu. Les numéros de cases sont propres au T4A et ne doivent
 * jamais être lus par l'extracteur du T4 de rémunération.
 */
export class T4AExtractor implements DocumentExtractor {
  readonly documentTypeCode = "T4A";

  canHandle(ocrText: string): boolean {
    const text = ocrText.toUpperCase();
    return text.includes("T4A") && (text.includes("PENSION") || text.includes("RETRAITE") || text.includes("ANNUITY") || text.includes("HONORAIRES"));
  }

  extract(ocrText: string, taxYear?: number): ExtractionResult {
    const detectedYear = extractYear(ocrText) ?? taxYear ?? null;
    // Cette expression exige des centimes : elle évite de prendre les numéros
    // de lignes ARC (11500, 43700, 10400) comme des montants déclarables.
    const money = "([0-9]{1,3}(?:[\\s,\\u00a0][0-9]{3})*(?:[.,][0-9]{2})|[0-9]+[.,][0-9]{2})";
    const box = (number: string) => `(?:box|case)\\s*(?:[-—]?\\s*(?:box|case)\\s*)?0?${number}\\b`;
    const definitions: Array<{ code: string; label: string; required: boolean; patterns: RegExp[] }> = [
      { code: "box_016", label: "Case 16 — Pension ou rente", required: false, patterns: [
        new RegExp(`${box("16")}[\\s\\S]{0,140}?${money}`, "i"),
        new RegExp(`\\b0?16\\b(?:\\s|:|-){1,24}${money}`, "i"),
        new RegExp(`(?:pension|superannuation|retraite|rente)[\\s\\S]{0,90}?${money}`, "i"),
      ] },
      { code: "box_018", label: "Case 18 — Paiement forfaitaire", required: false, patterns: [
        new RegExp(`${box("18")}[\\s\\S]{0,140}?${money}`, "i"),
        new RegExp(`\\b0?18\\b(?:\\s|:|-){1,24}${money}`, "i"),
        new RegExp(`(?:lump[ -]?sum|paiement\\s+forfaitaire)[\\s\\S]{0,90}?${money}`, "i"),
      ] },
      { code: "box_020", label: "Case 20 — Commissions de travail indépendant", required: false, patterns: [
        new RegExp(`${box("20")}[\\s\\S]{0,140}?${money}`, "i"),
        new RegExp(`\\b0?20\\b(?:\\s|:|-){1,24}${money}`, "i"),
        new RegExp(`(?:self[ -]?employed\\s+commissions|commissions?\\s+(?:de\\s+)?travail\\s+indépendant)[\\s\\S]{0,90}?${money}`, "i"),
      ] },
      { code: "box_022", label: "Case 22 — Impôt sur le revenu retenu", required: true, patterns: [
        new RegExp(`${box("22")}[\\s\\S]{0,140}?${money}`, "i"),
        new RegExp(`\\b0?22\\b(?:\\s|:|-){1,24}${money}`, "i"),
        new RegExp(`(?:income\\s+tax\\s+deducted|imp[oô]t\\s+sur\\s+le\\s+revenu\\s+retenu)[\\s\\S]{0,90}?${money}`, "i"),
      ] },
      { code: "box_024", label: "Case 24 — Rentes", required: false, patterns: [
        new RegExp(`${box("24")}[\\s\\S]{0,140}?${money}`, "i"),
        new RegExp(`\\b0?24\\b(?:\\s|:|-){1,24}${money}`, "i"),
        new RegExp(`(?:annuities|rentes?)[\\s\\S]{0,90}?${money}`, "i"),
      ] },
      { code: "box_048", label: "Case 48 — Honoraires pour services", required: false, patterns: [
        new RegExp(`${box("48")}[\\s\\S]{0,140}?${money}`, "i"),
        new RegExp(`\\b0?48\\b(?:\\s|:|-){1,24}${money}`, "i"),
        new RegExp(`(?:fees?\\s+for\\s+services|honoraires?\\s+pour\\s+services)[\\s\\S]{0,90}?${money}`, "i"),
      ] },
      { code: "box_105", label: "Case 105 — Bourses d’études ou subventions", required: false, patterns: [
        new RegExp(`${box("105")}[\\s\\S]{0,140}?${money}`, "i"),
        new RegExp(`\\b105\\b(?:\\s|:|-){1,24}${money}`, "i"),
        new RegExp(`(?:scholarship|bourse|fellowship|subvention)[\\s\\S]{0,90}?${money}`, "i"),
      ] },
    ];

    const fields: ExtractedField[] = definitions.map(definition => {
      let rawOcrValue: string | null = null;
      for (const pattern of definition.patterns) {
        const match = ocrText.match(pattern);
        if (match?.[1]) {
          rawOcrValue = match[1].replace(/\s+/g, "").trim();
          break;
        }
      }
      return {
        fieldCode: definition.code,
        fieldLabel: definition.label,
        rawOcrValue,
        confidence: rawOcrValue ? 90 : 0,
        needsReview: true,
        isRequired: definition.required,
        pageNumber: 1,
      };
    });
    const populated = fields.filter(field => field.rawOcrValue);
    return {
      fields,
      overallConfidence: populated.length ? Math.round(populated.reduce((total, field) => total + field.confidence, 0) / populated.length) : 0,
      needsHumanReview: true,
      yearMismatchWarning: detectedYear !== null && taxYear !== undefined && detectedYear !== taxYear,
      detectedTaxYear: detectedYear,
      detectedJurisdictionCode: "CA",
    };
  }
}

class BenefitSlipExtractor implements DocumentExtractor {
  constructor(readonly documentTypeCode: "T5007" | "RL-5") {}

  canHandle(ocrText: string): boolean {
    return this.documentTypeCode === "T5007"
      ? /\bT5007\b/i.test(ocrText) && /Statement of Benefits|État des prestations/i.test(ocrText)
      : /\bRL\s*-?\s*5\b|\bRelev[ée]\s*5\b/i.test(ocrText) && /Prestations et indemnités/i.test(ocrText);
  }

  extract(ocrText: string, taxYear?: number): ExtractionResult {
    const money = "([0-9]{1,3}(?:[\\s,\\u00a0][0-9]{3})*(?:[.,][0-9]{2})|[0-9]+[.,][0-9]{2})";
    const makeField = (fieldCode: string, fieldLabel: string, rawOcrValue: string | null): ExtractedField => ({
      fieldCode,
      fieldLabel,
      rawOcrValue: rawOcrValue?.replace(/\s+/g, "").trim() ?? null,
      confidence: rawOcrValue ? 88 : 0,
      needsReview: true,
      isRequired: false,
      pageNumber: 1,
    });
    let fields: ExtractedField[];

    if (this.documentTypeCode === "T5007") {
      // Le formulaire officiel imprime l’étiquette de la case 10 sur la ligne
      // du dessus et le montant sur la ligne suivante.
      const amount = ocrText.match(new RegExp(`\\b10\\s+Workers'?\\s+compensation\\s+benefits[\\s\\S]{0,160}?\\n\\s*20\\d{2}\\s+${money}`, "i"))?.[1]
        ?? ocrText.match(new RegExp(`Indemnités?\\s+pour\\s+accidents?\\s+du\\s+travail[\\s\\S]{0,160}?\\n\\s*20\\d{2}\\s+${money}`, "i"))?.[1]
        ?? null;
      fields = [makeField("box_10", "Case 10 — Indemnités pour accidents du travail / prestations", amount)];
    } else {
      // RL-5 : C et M apparaissent sur le même en-tête, puis leurs montants
      // sont alignés sur la ligne suivante. La position est vérifiée avant
      // toute proposition au client; aucune valeur n’est injectée automatiquement.
      const topAmounts = ocrText.match(new RegExp(`C\\s*-\\s*CNESST[\\s\\S]{0,500}?\\n\\s*${money}\\s+${money}`, "i"));
      const caseC = topAmounts?.[1] ?? null;
      const caseM = topAmounts?.[2] ?? null;
      const caseO = ocrText.match(new RegExp(`O\\s*-\\s*Redressement[\\s\\S]{0,260}?\\b20\\d{2}\\s+${money}`, "i"))?.[1] ?? null;
      fields = [
        makeField("case_c", "Case C — CNESST", caseC),
        makeField("case_m", "Case M — Redressement pour indemnités reçues", caseM),
        makeField("case_o", "Case O — Redressement pour années passées", caseO),
      ];
    }
    const filled = fields.filter(field => field.rawOcrValue);
    const detectedYear = extractYear(ocrText) ?? taxYear ?? null;
    return {
      fields,
      overallConfidence: filled.length ? 85 : 0,
      needsHumanReview: true,
      yearMismatchWarning: detectedYear !== null && taxYear !== undefined && detectedYear !== taxYear,
      detectedTaxYear: detectedYear,
      detectedJurisdictionCode: this.documentTypeCode === "RL-5" ? "QC" : "CA",
    };
  }
}

export const EXTRACTORS: DocumentExtractor[] = [
  new T4Extractor(),
  new T4AExtractor(),
  new BenefitSlipExtractor("T5007"),
  new BenefitSlipExtractor("RL-5"),
];

export function getExtractor(documentTypeCode: string): DocumentExtractor | null {
  return EXTRACTORS.find((e) => e.documentTypeCode === documentTypeCode) ?? null;
}
