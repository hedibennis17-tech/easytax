export const PROVINCE_CODES = [
  "AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT",
] as const;

export type ProvinceCode = (typeof PROVINCE_CODES)[number];

const PROVINCE_ALIASES: Record<string, ProvinceCode> = {
  AB: "AB",
  ALBERTA: "AB",
  BC: "BC",
  "COLOMBIE BRITANNIQUE": "BC",
  "BRITISH COLUMBIA": "BC",
  MB: "MB",
  MANITOBA: "MB",
  NB: "NB",
  "NOUVEAU BRUNSWICK": "NB",
  "NEW BRUNSWICK": "NB",
  NL: "NL",
  "TERRE NEUVE ET LABRADOR": "NL",
  "NEWFOUNDLAND AND LABRADOR": "NL",
  NS: "NS",
  "NOUVELLE ECOSSE": "NS",
  "NOVA SCOTIA": "NS",
  NT: "NT",
  "TERRITOIRES DU NORD OUEST": "NT",
  "NORTHWEST TERRITORIES": "NT",
  NU: "NU",
  NUNAVUT: "NU",
  ON: "ON",
  ONTARIO: "ON",
  PE: "PE",
  "ILE DU PRINCE EDOUARD": "PE",
  "PRINCE EDWARD ISLAND": "PE",
  QC: "QC",
  QUEBEC: "QC",
  SK: "SK",
  SASKATCHEWAN: "SK",
  YT: "YT",
  YUKON: "YT",
};

function canonicalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Accepte un code, un nom français ou un nom anglais, puis renvoie un code fiscal canadien. */
export function normalizeProvinceCode(value: unknown): ProvinceCode | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return PROVINCE_ALIASES[canonicalize(value)] ?? null;
}

export function isProvinceCode(value: unknown): value is ProvinceCode {
  return normalizeProvinceCode(value) === value;
}
