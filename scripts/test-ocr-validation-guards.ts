import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(path, "utf8");
}

function expectIncludes(path: string, expected: string) {
  const content = source(path);
  if (!content.includes(expected)) throw new Error(`${path} doit contenir: ${expected}`);
}

const syncRoute = "src/app/api/resume/sync-from-docs/route.ts";
const prefillRoute = "src/app/api/ocr-prefill/route.ts";
const dossierPage = "src/app/dossier/page.tsx";
const questionnairePage = "src/app/questionnaire/page.tsx";
const pipeline = "src/lib/pipeline.ts";

expectIncludes(syncRoute, 'eq(fiscalDocuments.status, "ready_for_tax_return")');
expectIncludes(syncRoute, 'eq(documentExtractions.status, "validated")');
expectIncludes(syncRoute, "isNotNull(documentExtractions.validatedAt)");
expectIncludes(prefillRoute, 'eq(fiscalDocuments.status, "ready_for_tax_return")');
expectIncludes(prefillRoute, 'eq(documentExtractions.status, "validated")');
expectIncludes(prefillRoute, "value: extractionFields.validatedValue");
expectIncludes(pipeline, 'status: !guard.accepted ? "rejected"');

if (source(dossierPage).includes('fetch("/api/resume/sync-from-docs", { method: "POST" })')) {
  throw new Error("Le dossier ne doit pas synchroniser des données OCR au chargement.");
}
if (source(questionnairePage).includes('fetch("/api/resume/sync-from-docs", { method: "POST" })')) {
  throw new Error("Le questionnaire ne doit pas synchroniser des données OCR avant validation.");
}

console.log("OCR validation guard tests passed: no pre-validation injection path found.");
