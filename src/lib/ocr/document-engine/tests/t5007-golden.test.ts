/**
 * Golden test — T5007 zone-based extractor
 *
 * Validates the EXTRACT_BOXES_ONLY architecture against the official
 * T5007 golden fixture.
 *
 * Run: npx tsx src/lib/ocr/document-engine/tests/t5007-golden.test.ts
 *
 * Expected results:
 *   ✓ box_10 → 7201.32  (→ lines 14400 + 25000)
 *   ✓ box_12 → 123456789 (NAS, no fiscal mapping)
 *   ✓ box_13 → O         (report code, no fiscal mapping)
 *   ✓ box_11 → null      (absent from fixture — optional)
 *   ✓ No hallucination from instructions section
 */

import fs from "fs";
import path from "path";
import { T5007Extractor } from "@/lib/extractors/t5007";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TestResult = { name: string; passed: boolean; message: string };

function assert(name: string, condition: boolean, message: string): TestResult {
  return { name, passed: condition, message };
}

// ─── Load fixture ─────────────────────────────────────────────────────────────

const fixtureDir = path.join(__dirname, "../fixtures/T5007");
const ocrText = fs.readFileSync(path.join(fixtureDir, "001_golden_2025.ocr.txt"), "utf-8");
const expected = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, "001_golden_2025.expected.json"), "utf-8")
);

// ─── Run extractor ────────────────────────────────────────────────────────────

const extractor = new T5007Extractor();
const result = extractor.extract(ocrText, 2025);

// ─── Tests ────────────────────────────────────────────────────────────────────

const results: TestResult[] = [];

// 1. canHandle
results.push(assert(
  "canHandle() detects T5007",
  extractor.canHandle(ocrText),
  "Le texte OCR doit être reconnu comme T5007"
));

// 2. Tax year
results.push(assert(
  "Detected tax year = 2025",
  result.detectedTaxYear === 2025,
  `Got: ${result.detectedTaxYear}`
));

// 3. Jurisdiction
results.push(assert(
  "Jurisdiction = CA",
  result.detectedJurisdictionCode === "CA",
  `Got: ${result.detectedJurisdictionCode}`
));

// 4. box_10 — Critical
const box10 = result.fields.find(f => f.fieldCode === "box_10");
results.push(assert(
  "box_10 extracted = 7201.32",
  box10?.rawOcrValue === "7201.32",
  `Got: ${box10?.rawOcrValue ?? "null"}`
));

// 5. box_10 confidence ≥ 85
results.push(assert(
  "box_10 confidence ≥ 85",
  (box10?.confidence ?? 0) >= 85,
  `Got confidence: ${box10?.confidence}`
));

// 6. box_11 — optional, should be null
const box11 = result.fields.find(f => f.fieldCode === "box_11");
results.push(assert(
  "box_11 = null (not in fixture)",
  box11?.rawOcrValue === null,
  `Got: ${box11?.rawOcrValue ?? "absent"}`
));

// 7. box_12 — NAS
const box12 = result.fields.find(f => f.fieldCode === "box_12");
results.push(assert(
  "box_12 (NAS) = 123456789",
  box12?.rawOcrValue === "123456789",
  `Got: ${box12?.rawOcrValue ?? "null"}`
));

// 8. box_13 — Report code
const box13 = result.fields.find(f => f.fieldCode === "box_13");
results.push(assert(
  "box_13 (report code) = O",
  box13?.rawOcrValue === "O",
  `Got: ${box13?.rawOcrValue ?? "null"}`
));

// 9. Anti-hallucination: box_10 must NOT be 14400 or 25000
results.push(assert(
  "ANTI-HALLUCINATION: box_10 ≠ 14400 or 25000",
  box10?.rawOcrValue !== "14400.00" &&
  box10?.rawOcrValue !== "25000.00" &&
  box10?.rawOcrValue !== "14400" &&
  box10?.rawOcrValue !== "25000",
  `box_10 = ${box10?.rawOcrValue} — must not be a T1 line number`
));

// 10. Anti-hallucination: box_13 must NOT be a number
const box13IsNotNumeric = box13?.rawOcrValue === null ||
  isNaN(Number(box13?.rawOcrValue));
results.push(assert(
  "ANTI-HALLUCINATION: box_13 is not a number",
  box13IsNotNumeric,
  `box_13 = ${box13?.rawOcrValue} — must be a code (O/M/C), never a number`
));

// 11. Anti-hallucination: box_10 must NOT be 1000 (from instructions example)
results.push(assert(
  "ANTI-HALLUCINATION: box_10 ≠ 1000.00 (from instruction example)",
  box10?.rawOcrValue !== "1000.00",
  `box_10 = ${box10?.rawOcrValue} — must not come from the 'example' in instructions`
));

// 12. Overall confidence > 0
results.push(assert(
  "overallConfidence > 0",
  result.overallConfidence > 0,
  `Got: ${result.overallConfidence}`
));

// ─── Print results ────────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  T5007 Golden Test — EXTRACT_BOXES_ONLY architecture v2");
console.log("═══════════════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;

for (const r of results) {
  if (r.passed) {
    console.log(`  ✓  ${r.name}`);
    passed++;
  } else {
    console.log(`  ✗  ${r.name}`);
    console.log(`       → ${r.message}`);
    failed++;
  }
}

console.log(`\n  ${passed}/${results.length} tests passés\n`);

if (failed > 0) {
  console.log("  ❌ ECHEC — corriger l'extracteur avant de continuer\n");
  process.exit(1);
} else {
  console.log("  ✅ SUCCÈS — T5007 validé, prêt pour le prochain feuillet\n");
}
