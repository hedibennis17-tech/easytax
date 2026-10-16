import assert from "node:assert/strict";
import { extractAllBoxes } from "../src/lib/ocr/dictionnaire";

const ocr = `MON DOSSIER | CITOYENS
RELEVÉ 1 - REVENUS D'EMPLOI ET REVENUS DIVERS
Année d'imposition
2025
Produit par
AMERICAN IRON & METAL COMPANY
Cases
A - Revenus d'emploi
B.A - Cotisation au RRQ
B.B - Cotisation supplémentaire au RRQ
C - Cotisation à l'assurance emploi
Données
1 482,62
74,01
19,42
D - Cotisation à un RPA
E - Impôt du Québec retenu
41,62
F - Cotisation syndicale
G - Salaire admissible au RRQ
1 482,62
H - Cotisation au RQAP
7,33
I - Salaire admissible au RQAP
1 482,62
J - Régime privé d'assurance maladie
K - Voyages (région éloignée)
L - Autres avantages
M - Commissions
N - Dons de bienfaisance
O - Autres revenus
P - Régime d'assurance interentreprises
Q - Salaires différés`;

const expected: Record<string, string | null> = {
  A: "1 482,62",
  "B.A": "74,01",
  "B.B": null,
  C: "19,42",
  D: null,
  E: "41,62",
  F: null,
  G: "1 482,62",
  H: "7,33",
  I: "1 482,62",
  J: null,
};

const boxes = extractAllBoxes(ocr, "RL-1");
const values = Object.fromEntries(
  boxes.filter((box) => Object.hasOwn(expected, box.code)).map((box) => [box.code, box.rawValue]),
);
assert.deepEqual(values, expected);
assert.equal(boxes.find((box) => box.code === "B.B")?.amountCents, null);
assert.equal(boxes.find((box) => box.code === "D")?.amountCents, null);
assert.equal(boxes.find((box) => box.code === "F")?.amountCents, null);
assert.equal(boxes.find((box) => box.code === "J")?.amountCents, null);

console.log("RL-1 OCR regression passed: A/B.A/C/E/G/H/I mapped; B.B/D/F/J remain empty.");
