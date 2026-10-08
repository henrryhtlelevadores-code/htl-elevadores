import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, roles, users } from "@/db";
import { createSessionToken, verifySessionToken } from "@/lib/session-token";
import { hasPermission } from "@/features/auth/permissions";
import { forbidden, unauthorized } from "./http";

/** Permiso que habilita el uso de la app de técnicos. */
export const MOBILE_PERMISSION = "work_orders:field";

/**
 * Duración del token de la app. Larga a propósito: el técnico trabaja sin
 * señal y no puede renovar. La revocación no depende de esto, sino de
 * `session_version` y del estado del usuario, que se comprueban en cada
 * petición.
 */
export const MOBILE_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface MobileUser {
  id: string;
  fullName: string;
  email: string;
  role: string | null;
}

export function issueMobileToken(userId: string, sessionVersion: number) {
  const token = createSessionToken("mobile", userId, sessionVersion, MOBILE_SESSION_TTL_SECONDS);
  return {
    token,
    // En milisegundos, para que la app sepa cuándo vence sin leer el token.
    expiresAt: (Math.floor(Date.now() / 1000) + MOBILE_SESSION_TTL_SECONDS) * 1000,
  };
}

async function loadUser(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      status: users.status,
      deletedAt: users.deletedAt,
      sessionVersion: users.sessionVersion,
      roleName: roles.name,
      roleIsActive: roles.isActive,
      permissions: roles.permissions,
    })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

function canUseApp(row: { roleIsActive: boolean | null; permissions: unknown }): boolean {
  if (row.roleIsActive === false || !Array.isArray(row.permissions)) return false;
  const granted = row.permissions.filter((p): p is string => typeof p === "string");
  return hasPermission(granted, MOBILE_PERMISSION);
}

/**
 * Datos del usuario para la respuesta de login. Lanza 403 si su rol no
 * puede usar la app.
 */
export async function mobileUserForLogin(userId: string): Promise<MobileUser> {
  const row = await loadUser(userId);
  if (!row || !canUseApp(row)) {
    throw forbidden("Tu usuario no tiene acceso a la app de técnicos.");
  }
  return { id: row.id, fullName: row.fullName, email: row.email, role: row.roleName };
}

/**
 * Técnico autenticado de la petición en curso. Exige `Authorization: Bearer`
 * con un token de tipo `mobile` vigente, usuario activo, sesión no revocada
 * y permiso para usar la app. Las cookies del panel no valen aquí.
 */
export async function requireMobileUser(): Promise<MobileUser & { sessionVersion: number }> {
  const header = (await headers()).get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  const claims = match ? verifySessionToken("mobile", match[1]) : null;
  if (!claims) throw unauthorized();

  const row = await loadUser(claims.subject);
  if (!row || row.deletedAt != null || row.status !== "ACTIVE") throw unauthorized();
  // Sesión revocada: cambio de contraseña, rol o estado desde que se emitió.
  if (row.sessionVersion !== claims.version) throw unauthorized();
  if (!canUseApp(row)) throw forbidden("Tu usuario no tiene acceso a la app de técnicos.");

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    role: row.roleName,
    sessionVersion: row.sessionVersion,
  };
}
