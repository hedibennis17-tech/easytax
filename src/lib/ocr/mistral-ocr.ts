import type { OcrProvider, OcrDocumentResult } from "./provider";

/**
 * MistralOcrProvider
 * Actif quand OCR_PROVIDER=mistral
 *
 * Variables requises:
 *   MISTRAL_API_KEY
 *
 * Mistral OCR retourne les données en Markdown structuré par page.
 * Le Markdown préserve les tableaux, titres et listes — idéal pour
 * les feuillets fiscaux canadiens (T4, RL-1, T5, T4A, etc.).
 *
 * Modèle : mistral-ocr-latest
 * Endpoint : POST https://api.mistral.ai/v1/ocr (via SDK @mistralai/mistralai)
 */

export class MistralOcrProvider implements OcrProvider {
  readonly name = "mistral";

  private getApiKey(): string {
    const key = process.env.MISTRAL_API_KEY;
    if (!key) {
      throw new Error(
        "MistralOcrProvider: variable manquante → MISTRAL_API_KEY"
      );
    }
    return key;
  }

  async processDocument(params: {
    buffer: Buffer;
    mimeType: string;
    documentId: string;
  }): Promise<OcrDocumentResult> {
    const start = Date.now();
    const apiKey = this.getApiKey();

    // Chargement dynamique du SDK Mistral
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let Mistral: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@mistralai/mistralai");
      Mistral = mod.Mistral ?? mod.default?.Mistral;
      if (!Mistral) throw new Error("Classe Mistral non trouvée dans le module");
    } catch {
      throw new Error(
        "Package @mistralai/mistralai absent. Lancez: npm install @mistralai/mistralai"
      );
    }

    const client = new Mistral({ apiKey });

    // Encoder le document en data URI base64
    const base64 = params.buffer.toString("base64");
    const dataUri = `data:${params.mimeType};base64,${base64}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;
    try {
      response = await client.ocr.process({
        model: "mistral-ocr-latest",
        document: {
          type: "document_url",
          documentUrl: dataUri,
        },
      });
    } catch (err) {
      throw new Error(
        `Mistral OCR API error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPages: any[] = response?.pages ?? [];

    if (rawPages.length === 0) {
      // Aucune page retournée — on retourne un résultat vide mais valide
      return {
        pages: [{ pageNumber: 1, text: "", confidence: 0, error: "Aucune page retournée par Mistral OCR" }],
        fullText: "",
        overallConfidence: 0,
        provider: "mistral",
        processingTimeMs: Date.now() - start,
      };
    }

    // Construire les pages à partir du Markdown Mistral
    const pages = rawPages.map((page: { index?: number; markdown?: string }, i: number) => {
      const text = page.markdown ?? "";
      return {
        pageNumber: (page.index ?? i) + 1,
        text,
        confidence: text.trim().length > 0 ? 90 : 0, // Mistral OCR est haut-confiance par défaut
      };
    });

    const fullText = pages.map(p => p.text).join("\n\n");
    const overallConfidence =
      pages.length > 0
        ? Math.round(pages.reduce((s, p) => s + p.confidence, 0) / pages.length)
        : 0;

    return {
      pages,
      fullText,
      overallConfidence,
      provider: "mistral",
      processingTimeMs: Date.now() - start,
    };
  }
}
