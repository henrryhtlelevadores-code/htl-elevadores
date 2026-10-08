"use server";

import { verifyCostCenterCredentials } from "./credentials";
import { createPortalSession, getPortalSessionCostCenterId } from "./server";
import { getPortalQuotation } from "./quotations";
import { storeQuotationPdf } from "@/features/quotations/pdf";
import { getErrorMessage } from "@/lib/errors";

export type PortalLoginActionResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

/** Pública por diseño: es la puerta de entrada del portal del cliente. */
export async function portalLoginAction(input: {
  costCenterId: string;
  password: string;
}): Promise<PortalLoginActionResult> {
  try {
    const res = await verifyCostCenterCredentials(input.costCenterId, input.password);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    await createPortalSession(res.costCenter.id, res.costCenter.sessionVersion);
    return { success: true, redirectTo: `/portal/${res.costCenter.id}` };
  } catch (error) {
    console.error("Error en portalLoginAction:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Genera (o reutiliza) el PDF de una cotización para el cliente del portal.
 * La sede sale de la sesión, así que no se puede pedir el PDF de otra sede.
 */
export async function portalQuotationPdfAction(quotationId: string) {
  const costCenterId = await getPortalSessionCostCenterId();
  if (!costCenterId) {
    return { success: false as const, error: "Sesión del portal requerida" };
  }
  const quotation = await getPortalQuotation(costCenterId, quotationId);
  if (!quotation) {
    return { success: false as const, error: "Cotización no encontrada" };
  }
  return storeQuotationPdf(quotation.id);
}
