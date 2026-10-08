import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./server";
import { hasAnyPermission } from "./permissions";

export type AuthErrorCode = "UNAUTHENTICATED" | "FORBIDDEN";

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(
      code === "UNAUTHENTICATED"
        ? "Sesión de personal requerida"
        : "No tienes permiso para realizar esta acción"
    );
    this.name = "AuthError";
  }
}

type Check =
  | { ok: true; user: SessionUser }
  | { ok: false; code: AuthErrorCode };

async function check(permissions: readonly string[]): Promise<Check> {
  const user = await getSessionUser();
  if (!user) return { ok: false, code: "UNAUTHENTICATED" };
  if (!hasAnyPermission(user.permissions, permissions)) {
    return { ok: false, code: "FORBIDDEN" };
  }
  return { ok: true, user };
}

/**
 * Exige sesión de personal y al menos uno de los permisos indicados.
 * Lanza `AuthError` si no se cumple. Toda server action y ruta API debe
 * llamarlo (o a `denyUnless`): el proxy no las protege.
 */
export async function requirePermission(...permissions: string[]): Promise<SessionUser> {
  const result = await check(permissions);
  if (!result.ok) throw new AuthError(result.code);
  return result.user;
}

/**
 * Variante para acciones que responden `{ success, error }`: devuelve el
 * resultado de error si falta sesión o permiso, o `null` si puede continuar.
 */
export async function denyUnless(
  ...permissions: string[]
): Promise<{ success: false; error: string } | null> {
  const result = await check(permissions);
  if (result.ok) return null;
  return { success: false, error: new AuthError(result.code).message };
}

/** Para páginas y UI: `true` si la sesión actual tiene alguno de los permisos. */
export async function can(...permissions: string[]): Promise<boolean> {
  return (await check(permissions)).ok;
}

/**
 * Para páginas del panel: sin sesión manda al login y sin permiso a la
 * pantalla "Sin acceso". Debe ser la primera llamada de la página, antes de
 * cargar datos.
 */
export async function requirePageAccess(...permissions: string[]): Promise<SessionUser> {
  const result = await check(permissions);
  if (result.ok) return result.user;
  redirect(result.code === "UNAUTHENTICATED" ? "/login" : "/sin-acceso");
}

/** Ejecuta la lectura solo si hay permiso; si no, devuelve el valor alterno. */
export async function readIfAllowed<T>(
  permissions: string[],
  read: () => Promise<T>,
  fallback: T
): Promise<T> {
  return (await can(...permissions)) ? read() : fallback;
}
