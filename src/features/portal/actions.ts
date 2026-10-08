"use server";

import { verifyCostCenterCredentials } from "./credentials";
import { createPortalSession } from "./server";
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
