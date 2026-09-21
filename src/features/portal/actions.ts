"use server";

import { verifyCostCenterCredentials } from "@/features/clients/actions";
import { createPortalSession } from "./server";
import { getErrorMessage } from "@/lib/errors";

export type PortalLoginActionResult =
  | { success: true; redirectTo: string }
  | { success: false; error: string };

export async function portalLoginAction(input: {
  costCenterId: string;
  password: string;
}): Promise<PortalLoginActionResult> {
  try {
    const res = await verifyCostCenterCredentials(input.costCenterId, input.password);
    if (!res.success) {
      return { success: false, error: res.error };
    }

    await createPortalSession(res.costCenter.id);
    return { success: true, redirectTo: `/portal/${res.costCenter.id}` };
  } catch (error) {
    console.error("Error en portalLoginAction:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}