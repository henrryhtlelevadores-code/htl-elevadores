/**
 * Permisos por rol. Lógica pura (sin base de datos) para poder probarla.
 *
 * Un permiso es una lista de segmentos separados por ":", por ejemplo
 * `users:read` o `work_orders:panel:write`. Un permiso concedido cubre al
 * requerido cuando sus segmentos son un prefijo EXACTO de los del requerido:
 *
 *   concedido `work_orders`  -> cubre `work_orders:panel:write`
 *   concedido `users:read`   -> cubre `users:read`, no `users:write`
 *   concedido `users:read`   -> NO cubre `users:readonly` (se compara por
 *                               segmentos completos, nunca por subcadena)
 *   concedido `*`            -> cubre todo
 */

/** Espacio de nombres de permisos de cada módulo del panel. */
export const MODULE_PERMISSION = {
  clients: "clients",
  contracts: "contracts",
  equipment: "equipment",
  invoices: "invoices",
  maintenance: "maintenance",
  masters: "masters",
  quotations: "quotations",
  reports: "reports",
  routes: "routes",
  safety: "safety",
  users: "users",
  // Las OT se separan en panel (oficina) y field (app del técnico).
  workOrders: "work_orders:panel",
} as const;

const SEGMENT = /^[a-z0-9_]+$/;

function segments(permission: string): string[] | null {
  const parts = permission.split(":");
  return parts.every((part) => SEGMENT.test(part)) ? parts : null;
}

function grants(granted: string, required: string[]): boolean {
  if (granted === "*") return true;
  const grantedParts = segments(granted);
  // Un permiso mal formado en la base no concede nada.
  if (!grantedParts || grantedParts.length > required.length) return false;
  return grantedParts.every((part, index) => part === required[index]);
}

export function hasPermission(granted: readonly string[], required: string): boolean {
  const requiredParts = segments(required);
  if (!requiredParts) return false;
  return granted.some((permission) => grants(permission, requiredParts));
}

export function hasAnyPermission(
  granted: readonly string[],
  required: readonly string[]
): boolean {
  return required.some((permission) => hasPermission(granted, permission));
}
