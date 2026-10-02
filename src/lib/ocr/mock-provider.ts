import type { OcrProvider, OcrDocumentResult } from "./provider";

/**
 * MockOcrProvider — actif quand OCR_PROVIDER=mock (défaut)
 * Retourne du texte simulé réaliste pour tester le pipeline complet
 * sans clé API ni coût.
 */
export class MockOcrProvider implements OcrProvider {
  readonly name = "mock";

  async processDocument(params: {
    buffer: Buffer;
    mimeType: string;
    documentId: string;
  }): Promise<OcrDocumentResult> {
    const start = Date.now();

    // Simuler un délai de traitement réaliste
    await new Promise((r) => setTimeout(r, 300));

    // Texte mock d'un T4 réaliste (données fictives uniquement)
    const mockT4Text = `
Canada Revenue Agency / Agence du revenu du Canada
T4 Statement of Remuneration Paid / État de la rémunération payée
2025

Employer's name and address / Nom et adresse de l'employeur
ACME CORPORATION INC.
123 Business Street
Montreal QC H2X 1Y4

Employee's name / Nom de l'employé
JOHN DOE

Social Insurance Number: *** *** 000
Employee's account number: 12345

Box 14 - Employment income / Revenus d'emploi: 52,400.00
Box 16 - Employee's CPP contributions / Cotisations de l'employé au RPC: 2,860.20
Box 18 - Employee's EI premiums / Cotisations de l'employé à l'AE: 780.00
Box 22 - Income tax deducted / Impôt sur le revenu retenu: 9,100.00
Box 24 - EI insurable earnings / Gains assurables aux fins de l'AE: 52,400.00
Box 26 - CPP/QPP pensionable earnings: 52,400.00
Box 44 - Union dues / Cotisations syndicales: 0.00
Box 46 - Charitable donations / Dons de bienfaisance: 0.00
Box 50 - RPP or DPSP registration number: 
Box 52 - Pension adjustment / Facteur d'équivalence: 0.00

Province of employment / Province d'emploi: QC
`;

    return {
      pages: [
        {
          pageNumber: 1,
          text: mockT4Text.trim(),
          confidence: 96,
        },
      ],
      fullText: mockT4Text.trim(),
      overallConfidence: 96,
      provider: "mock",
      processingTimeMs: Date.now() - start,
    };
  }
}
