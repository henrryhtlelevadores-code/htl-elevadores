import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { createSessionToken, verifySessionToken, SESSION_COOKIE } from "./session";
import { sessionCookieOptions } from "@/lib/session-token";
import { db, roles, users } from "@/db";

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  roleName: string | null;
  permissions: string[];
}

export async function createSession(userId: string, sessionVersion = 0) {
  const { token, maxAge } = createSessionToken(userId, sessionVersion);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
}

export async function destroySession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

function parsePermissions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * Usuario de la sesión de personal, validado contra la base de datos: el
 * token debe ser de tipo staff y el usuario existir, no estar eliminado y
 * estar activo. Ante cualquier duda (incluido un error de consulta) devuelve
 * `null`: la sesión nunca "falla abierta".
 *
 * `cache()` memoiza por render de servidor o por invocación de acción; no
 * comparte resultado entre acciones distintas.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = verifySessionToken(token);
  if (!claims) return null;

  try {
    const [row] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        status: users.status,
        deletedAt: users.deletedAt,
        roleName: roles.name,
        roleIsActive: roles.isActive,
        permissions: roles.permissions,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, claims.subject))
      .limit(1);

    if (!row || row.deletedAt != null || row.status !== "ACTIVE") return null;

    return {
      id: row.id,
      fullName: row.fullName,
      email: row.email,
      roleName: row.roleName,
      // Un rol desactivado no concede ningún permiso.
      permissions: row.roleIsActive === false ? [] : parsePermissions(row.permissions),
    };
  } catch (error) {
    console.error("Error al resolver la sesión:", error);
    return null;
  }
});

export async function getSessionUserId(): Promise<string | null> {
  return (await getSessionUser())?.id ?? null;
}

/**
 * Garantiza que la llamada provenga de una sesión de personal (staff) activa.
 * Devuelve el usuario o lanza un error.
 */
export async function requireStaffSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const error = new Error("Sesión de personal requerida");
    (error as Error & { code?: string }).code = "UNAUTHENTICATED";
    throw error;
  }
  return user;
}
