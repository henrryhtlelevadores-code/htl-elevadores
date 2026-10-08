"use server";

import { requirePermission } from "@/features/auth/guard";
import { quotationPdfDataUrl, storeQuotationPdf } from "./pdf";

/** Vista previa o descarga del PDF de una cotización (personal). */
export async function getQuotationPdfDataUrl(quotationId: string) {
  await requirePermission("quotations:read");
  return quotationPdfDataUrl(quotationId);
}

/** Genera (o reutiliza) el PDF persistido de una cotización (personal). */
export async function generateAndStoreQuotationPdf(quotationId: string) {
  await requirePermission("quotations:read");
  return storeQuotationPdf(quotationId);
}
