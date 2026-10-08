import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import {
  createPortalSessionToken,
  verifyPortalSessionToken,
  PORTAL_SESSION_COOKIE,
} from "./session";
import { sessionCookieOptions } from "@/lib/session-token";
import { db, costCenters } from "@/db";

export async function createPortalSession(costCenterId: string, sessionVersion = 0) {
  const { token, maxAge } = createPortalSessionToken(costCenterId, sessionVersion);
  const store = await cookies();
  store.set(PORTAL_SESSION_COOKIE, token, sessionCookieOptions(maxAge));
}

export async function destroyPortalSession() {
  const store = await cookies();
  store.set(PORTAL_SESSION_COOKIE, "", sessionCookieOptions(0));
}

/**
 * Centro de costo de la sesión del portal, validado contra la base: debe
 * existir, no estar eliminado y conservar credenciales. Devuelve `null` ante
 * cualquier duda, incluido un error de consulta.
 */
export const getPortalSessionCostCenterId = cache(async (): Promise<string | null> => {
  const store = await cookies();
  const token = store.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = verifyPortalSessionToken(token);
  if (!claims) return null;

  try {
    const [row] = await db
      .select({ id: costCenters.id, passwordHash: costCenters.passwordHash })
      .from(costCenters)
      .where(and(eq(costCenters.id, claims.subject), isNull(costCenters.deletedAt)))
      .limit(1);
    if (!row || !row.passwordHash) return null;
    return row.id;
  } catch (error) {
    console.error("Error al resolver la sesión del portal:", error);
    return null;
  }
});
