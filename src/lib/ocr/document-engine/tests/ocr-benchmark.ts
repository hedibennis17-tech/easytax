/**
 * EasyTax Document Intelligence Engine — OCR Benchmark
 *
 * Usage:
 *   npx ts-node src/lib/ocr/document-engine/tests/ocr-benchmark.ts [slipType]
 *
 * Examples:
 *   npx ts-node ...ocr-benchmark.ts           ← run all fixtures
 *   npx ts-node ...ocr-benchmark.ts T4        ← run only T4 fixtures
 *   npx ts-node ...ocr-benchmark.ts T5007     ← run only T5007 fixtures
 */

import fs from "fs";
import path from "path";
import { extractAllBoxes } from "../../dictionnaire";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FixtureExpected {
  documentType: string;
  taxYear: number;
  fields: Record<string, number | string>;
}

interface FieldResult {
  field: string;
  expected: number | string;
  actual: number | string | null;
  match: boolean;
}

interface FixtureResult {
  fixture: string;
  docType: string;
  level1_docRecognized: boolean;
  level2_fields: FieldResult[];
  level2_accuracy: number;
  level3_typeErrors: string[];
  errors: string[];
}

interface SlipSummary {
  slipType: string;
  totalFixtures: number;
  level1_accuracy: number;
  level2_accuracy: number;
  fieldBreakdown: Record<string, { correct: number; total: number; accuracy: number }>;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.join(__dirname, "../fixtures");
const TOLERANCE = 0.02; // 2 cents tolerance for money comparisons

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

function compareField(
  expected: number | string,
  actual: number | string | null
): boolean {
  if (actual === null || actual === undefined) return false;
  if (typeof expected === "number") {
    const num = typeof actual === "number" ? actual : parseFloat(String(actual));
    return isClose(expected, num);
  }
  return String(expected).trim().toLowerCase() === String(actual).trim().toLowerCase();
}

// ─── Run one fixture ─────────────────────────────────────────────────────────

async function runFixture(
  fixturePath: string,
  expectedPath: string
): Promise<FixtureResult> {
  const fixture = path.basename(fixturePath);
  const expectedRaw = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
  const expectedArr: FixtureExpected[] = Array.isArray(expectedRaw)
    ? expectedRaw
    : [expectedRaw];

  const result: FixtureResult = {
    fixture,
    docType: expectedArr[0]?.documentType ?? "UNKNOWN",
    level1_docRecognized: false,
    level2_fields: [],
    level2_accuracy: 0,
    level3_typeErrors: [],
    errors: [],
  };

  // Read OCR text (in real use, call Google Document AI here)
  // For now, read a companion .ocr.txt file if present
  const ocrTxtPath = fixturePath.replace(/\.(pdf|jpg|jpeg|png)$/i, ".ocr.txt");
  if (!fs.existsSync(ocrTxtPath)) {
    result.errors.push(`Missing OCR text file: ${path.basename(ocrTxtPath)}`);
    return result;
  }

  const ocrText = fs.readFileSync(ocrTxtPath, "utf-8");

  // Level 1: document recognized
  const docType = expectedArr[0]?.documentType;
  result.level1_docRecognized = ocrText.includes(docType);

  // Level 2: field accuracy
  for (const expected of expectedArr) {
    let extracted: Record<string, number | null>;
    try {
      extracted = extractAllBoxes(ocrText, expected.documentType);
    } catch (e) {
      result.errors.push(`extractAllBoxes failed: ${String(e)}`);
      continue;
    }

    for (const [field, expectedValue] of Object.entries(expected.fields)) {
      if (field === "taxYear") continue; // handled separately
      const actual = extracted[field] ?? null;
      const match = compareField(expectedValue as number | string, actual);

      result.level2_fields.push({ field, expected: expectedValue as number | string, actual, match });
    }
  }

  const correct = result.level2_fields.filter((f) => f.match).length;
  result.level2_accuracy =
    result.level2_fields.length > 0
      ? Math.round((correct / result.level2_fields.length) * 100)
      : 100;

  return result;
}

// ─── Run all fixtures for one slip type ──────────────────────────────────────

async function runSlipType(slipDir: string): Promise<SlipSummary> {
  const slipType = path.basename(slipDir);
  const files = fs.readdirSync(slipDir).filter((f) =>
    /\.(pdf|jpg|jpeg|png)$/i.test(f)
  );

  const results: FixtureResult[] = [];
  const fieldStats: Record<string, { correct: number; total: number }> = {};

  for (const file of files) {
    const fixturePath = path.join(slipDir, file);
    const expectedPath = fixturePath.replace(/\.(pdf|jpg|jpeg|png)$/i, ".expected.json");
    if (!fs.existsSync(expectedPath)) continue;

    const result = await runFixture(fixturePath, expectedPath);
    results.push(result);

    for (const f of result.level2_fields) {
      if (!fieldStats[f.field]) fieldStats[f.field] = { correct: 0, total: 0 };
      fieldStats[f.field].total++;
      if (f.match) fieldStats[f.field].correct++;
    }
  }

  const fieldBreakdown: SlipSummary["fieldBreakdown"] = {};
  for (const [field, stats] of Object.entries(fieldStats)) {
    fieldBreakdown[field] = {
      ...stats,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 100,
    };
  }

  const level1Correct = results.filter((r) => r.level1_docRecognized).length;
  const totalL2 = results.reduce((s, r) => s + r.level2_fields.length, 0);
  const correctL2 = results.reduce(
    (s, r) => s + r.level2_fields.filter((f) => f.match).length,
    0
  );

  // Print detailed results
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${slipType} — ${results.length} fixture(s)`);
  console.log(`${"═".repeat(60)}`);

  for (const r of results) {
    const l1 = r.level1_docRecognized ? "✓" : "✗";
    const l2 = `${r.level2_accuracy}%`;
    console.log(`\n  [${l1}] ${r.fixture}  (L2: ${l2})`);

    if (r.errors.length) {
      for (const e of r.errors) console.log(`    ⚠  ${e}`);
    }

    for (const f of r.level2_fields) {
      const icon = f.match ? "✓" : "✗";
      const exp = f.expected;
      const act = f.actual ?? "(not found)";
      const detail = f.match ? "" : `  expected ${exp}, got ${act}`;
      console.log(`    ${icon} ${f.field}${detail}`);
    }
  }

  return {
    slipType,
    totalFixtures: results.length,
    level1_accuracy:
      results.length > 0 ? Math.round((level1Correct / results.length) * 100) : 0,
    level2_accuracy: totalL2 > 0 ? Math.round((correctL2 / totalL2) * 100) : 0,
    fieldBreakdown,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filterSlip = process.argv[2] ?? null;

  const slipDirs = fs
    .readdirSync(FIXTURES_DIR)
    .filter((d) => fs.statSync(path.join(FIXTURES_DIR, d)).isDirectory())
    .filter((d) => !filterSlip || d === filterSlip)
    .map((d) => path.join(FIXTURES_DIR, d));

  if (slipDirs.length === 0) {
    console.log(filterSlip ? `No fixtures found for ${filterSlip}` : "No fixture directories found");
    process.exit(0);
  }

  const summaries: SlipSummary[] = [];
  for (const dir of slipDirs) {
    const summary = await runSlipType(dir);
    summaries.push(summary);
  }

  // Global summary table
  console.log(`\n${"═".repeat(60)}`);
  console.log("  BENCHMARK SUMMARY");
  console.log(`${"═".repeat(60)}`);
  console.log(
    `  ${"SLIP".padEnd(12)} ${"FIXTURES".padEnd(10)} ${"L1 DOC%".padEnd(10)} ${"L2 FIELD%"}`
  );
  console.log(`  ${"─".repeat(46)}`);

  for (const s of summaries) {
    if (s.totalFixtures === 0) continue;
    console.log(
      `  ${s.slipType.padEnd(12)} ${String(s.totalFixtures).padEnd(10)} ${String(s.level1_accuracy + "%").padEnd(10)} ${s.level2_accuracy}%`
    );
  }

  const totalFixtures = summaries.reduce((a, b) => a + b.totalFixtures, 0);
  const avgL2 =
    summaries.length > 0
      ? Math.round(
          summaries.filter((s) => s.totalFixtures > 0).reduce((a, b) => a + b.level2_accuracy, 0) /
            summaries.filter((s) => s.totalFixtures > 0).length
        )
      : 0;
  console.log(`  ${"─".repeat(46)}`);
  console.log(`  ${"TOTAL".padEnd(12)} ${String(totalFixtures).padEnd(10)} ${"".padEnd(10)} ${avgL2}%`);
  console.log();
}

main().catch((e) => {
  console.error("Benchmark error:", e);
  process.exit(1);
});
