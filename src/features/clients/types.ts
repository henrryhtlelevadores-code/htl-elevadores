import type { CostCenter } from "@/db";

/**
 * Sede tal como se envía al navegador. El hash de la credencial del portal y
 * la versión de sesión nunca salen del servidor: el cliente solo sabe si la
 * sede tiene credencial o no.
 */
export type CostCenterView = Omit<CostCenter, "passwordHash" | "portalSessionVersion"> & {
  hasPortalPassword: boolean;
};
