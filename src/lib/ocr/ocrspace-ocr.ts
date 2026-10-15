import type { OcrProvider, OcrDocumentResult } from "./provider";

/**
 * OcrSpaceProvider
 * Actif quand OCR_PROVIDER=ocrspace
 *
 * Variables requises:
 *   OCRSPACE_API_KEY  — clé API OCR.space (gratuite ou PRO)
 *
 * Doc: https://ocr.space/ocrapi
 *
 * Moteur utilisé : Engine 3 (le plus précis, 200+ langues, tableaux, cases)
 * Fallback auto  : Engine 2 si Engine 3 échoue
 *
 * Le texte extrait est retourné en texte brut (ParsedText).
 * isTable=true active la reconnaissance de tableaux (Markdown en Engine 3).
 */

const OCR_ENDPOINT = "https://api.ocr.space/parse/image";

export class OcrSpaceProvider implements OcrProvider {
  readonly name = "ocrspace";

  private getApiKey(): string {
    const key = process.env.OCRSPACE_API_KEY;
    if (!key) {
      throw new Error(
        "OcrSpaceProvider: variable manquante → OCRSPACE_API_KEY"
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

    // Encode le document en base64 avec data URI
    const base64 = params.buffer.toString("base64");
    const base64Image = `data:${params.mimeType};base64,${base64}`;

    const text = await this.callOcrSpace(apiKey, base64Image, 3);

    const pages = [{
      pageNumber: 1,
      text,
      confidence: text.trim().length > 0 ? 85 : 0,
    }];

    const fullText = text;
    const overallConfidence = pages[0].confidence;

    return {
      pages,
      fullText,
      overallConfidence,
      provider: "ocrspace",
      processingTimeMs: Date.now() - start,
    };
  }

  /**
   * Appelle l'API OCR.space avec le moteur spécifié.
   * Retourne le texte extrait (ParsedText de toutes les pages concaténées).
   */
  private async callOcrSpace(
    apiKey: string,
    base64Image: string,
    engine: 2 | 3
  ): Promise<string> {
    const formData = new FormData();
    formData.append("base64Image", base64Image);
    formData.append("language", "auto");
    formData.append("OCREngine", String(engine));
    formData.append("isTable", "true");
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("isOverlayRequired", "false");

    let response: Response;
    try {
      response = await fetch(OCR_ENDPOINT, {
        method: "POST",
        headers: {
          apikey: apiKey,
        },
        body: formData,
      });
    } catch (err) {
      throw new Error(
        `OCR.space réseau: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Si Engine 3 échoue (quota dépassé), on tente Engine 2
      if (engine === 3 && (response.status === 429 || response.status === 403)) {
        console.warn("[ocrspace] Engine 3 quota dépassé, fallback Engine 2");
        return this.callOcrSpace(apiKey, base64Image, 2);
      }
      throw new Error(
        `OCR.space HTTP ${response.status}: ${body.slice(0, 200)}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new Error("OCR.space: réponse JSON invalide");
    }

    // OCRExitCode: 1=succès, 2=partiel, 3=échec, 4=erreur fatale
    if (json.IsErroredOnProcessing) {
      const errMsg = json.ErrorMessage ?? json.ErrorDetails ?? "Erreur OCR.space inconnue";
      // Fallback Engine 2 si Engine 3 échoue sur le traitement
      if (engine === 3) {
        console.warn(`[ocrspace] Engine 3 erreur (${errMsg}), fallback Engine 2`);
        return this.callOcrSpace(apiKey, base64Image, 2);
      }
      throw new Error(`OCR.space erreur: ${errMsg}`);
    }

    // Concaténer le texte de toutes les pages
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsedResults: any[] = json.ParsedResults ?? [];
    if (parsedResults.length === 0) {
      return "";
    }

    const allText = parsedResults
      .map((r: { ParsedText?: string }) => r.ParsedText ?? "")
      .join("\n\n")
      .trim();

    return allText;
  }
}
