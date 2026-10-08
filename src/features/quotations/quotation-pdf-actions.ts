"use server";

import { requirePermission } from "@/features/auth/guard";
import { quotationPdfPath } from "@/lib/pdf-paths";
import { storeQuotationPdf } from "./pdf";

/**
 * Genera (o reutiliza) el PDF de una cotización y devuelve la ruta de la app
 * por la que se ve. Nunca devuelve la URL del bucket.
 */
export async function generateAndStoreQuotationPdf(quotationId: string): Promise<
  | { success: true; pdfUrl: string; generatedAt: number; reused: boolean }
  | { success: false; error: string }
> {
  await requirePermission("quotations:read");
  const result = await storeQuotationPdf(quotationId);
  if (!result.success) return result;
  return {
    success: true,
    pdfUrl: quotationPdfPath(quotationId, result.generatedAt),
    generatedAt: result.generatedAt,
    reused: result.reused,
  };
}
