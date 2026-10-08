import "server-only";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, quotations } from "@/db/index";
import { loadQuotationDetail } from "@/features/quotations/queries";
import type { QuotationDetail } from "@/features/quotations/actions";

/** Estados de cotización que el cliente puede ver en el portal. */
const PORTAL_VISIBLE_STATUSES = ["SENT", "ACCEPTED"];

/**
 * Cotización vista desde el portal. Solo se devuelve si pertenece a la sede
 * indicada y ya fue emitida; en cualquier otro caso `null`, sin distinguir
 * "no existe" de "es de otra sede".
 *
 * `costCenterId` debe venir de la sesión del portal, nunca de la petición.
 */
export async function getPortalQuotation(
  costCenterId: string,
  quotationId: string
): Promise<QuotationDetail | null> {
  const detail = await loadQuotationDetail(quotationId);
  if (!detail || detail.costCenterId !== costCenterId) return null;
  if (!PORTAL_VISIBLE_STATUSES.includes(detail.status ?? "")) return null;
  return detail;
}

/** Acepta una cotización emitida de la sede de la sesión del portal. */
export async function acceptPortalQuotation(
  costCenterId: string,
  quotationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const quotation = await getPortalQuotation(costCenterId, quotationId);
  if (!quotation) {
    return { success: false, error: "Cotización no encontrada." };
  }
  if (quotation.status !== "SENT") {
    return { success: false, error: "Solo se pueden aceptar cotizaciones emitidas." };
  }
  await db
    .update(quotations)
    .set({ status: "ACCEPTED" })
    .where(eq(quotations.id, quotationId));
  revalidatePath(`/portal/${costCenterId}`);
  revalidatePath(`/portal/${costCenterId}/cotizaciones/${quotationId}`);
  return { success: true };
}
