import { db } from "@/lib/db";
import { documentTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  CATALOG_DOCUMENT_TYPES,
  catalogDocumentLabelEn,
  catalogDocumentLabelFr,
  getCatalogDocumentType,
} from "./catalog";

function valuesFor(code: string, sortOrder: number) {
  const document = getCatalogDocumentType(code);
  if (!document) return null;
  const quebecOnly = document.jurisdictions.length > 0 && document.jurisdictions.every(jurisdiction => jurisdiction === "QC");
  return {
    code: document.code,
    labelFr: catalogDocumentLabelFr(document.code),
    labelEn: catalogDocumentLabelEn(document.code),
    category: document.family.slice(0, 50),
    isFederal: !quebecOnly,
    isQuebec: document.jurisdictions.includes("QC"),
    isActive: true,
    sortOrder,
  };
}

/** Assure qu'un type prouvé par OCR a un identifiant SQL pour sa provenance. */
export async function ensureCatalogDocumentType(code: string): Promise<string | null> {
  const document = getCatalogDocumentType(code);
  if (!document) return null;

  const [existing] = await db
    .select({ id: documentTypes.id })
    .from(documentTypes)
    .where(eq(documentTypes.code, document.code))
    .limit(1);
  if (existing) return existing.id;

  const values = valuesFor(document.code, CATALOG_DOCUMENT_TYPES.findIndex(item => item.code === document.code) + 1);
  if (!values) return null;
  await db.insert(documentTypes).values(values).onConflictDoUpdate({
    target: documentTypes.code,
    set: {
      labelFr: values.labelFr,
      labelEn: values.labelEn,
      category: values.category,
      isFederal: values.isFederal,
      isQuebec: values.isQuebec,
      isActive: values.isActive,
      sortOrder: values.sortOrder,
    },
  });

  const [created] = await db
    .select({ id: documentTypes.id })
    .from(documentTypes)
    .where(eq(documentTypes.code, document.code))
    .limit(1);
  return created?.id ?? null;
}

/** Rend les 48 types visibles à l'API sans les dupliquer lors des appels suivants. */
export async function ensureCatalogDocumentTypes(): Promise<void> {
  for (const [index, document] of CATALOG_DOCUMENT_TYPES.entries()) {
    const values = valuesFor(document.code, index + 1);
    if (values) await db.insert(documentTypes).values(values).onConflictDoUpdate({
      target: documentTypes.code,
      set: {
        labelFr: values.labelFr,
        labelEn: values.labelEn,
        category: values.category,
        isFederal: values.isFederal,
        isQuebec: values.isQuebec,
        isActive: values.isActive,
        sortOrder: values.sortOrder,
      },
    });
  }
}
