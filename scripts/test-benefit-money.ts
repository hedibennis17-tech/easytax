import { parseMoneyCents, hasTaxMappingForDocumentType } from "../src/lib/ocr-to-entries";

const cases: Array<[string, number]> = [
  ["7 201,32", 720132],
  ["7,201.32", 720132],
  ["3 507,60", 350760],
];

for (const [raw, expected] of cases) {
  const actual = parseMoneyCents(raw);
  if (actual !== expected) throw new Error(`${raw}: ${actual} cents au lieu de ${expected}`);
}
for (const type of ["T5007", "RL-5"]) {
  if (!hasTaxMappingForDocumentType(type)) throw new Error(`${type} doit avoir un mapping fiscal validé.`);
}
console.log("Benefit amount tests passed: Canadian decimals and validated mapping are correct.");
