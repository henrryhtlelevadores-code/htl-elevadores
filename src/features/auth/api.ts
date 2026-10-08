import "server-only";
import { NextResponse } from "next/server";
import { AuthError, requirePermission } from "./guard";
import type { SessionUser } from "./server";

type ApiAuth =
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse };

/**
 * Autorización para rutas API: 401 sin sesión de personal y 403 sin alguno
 * de los permisos indicados.
 */
export async function authorizeApi(...permissions: string[]): Promise<ApiAuth> {
  try {
    return { ok: true, user: await requirePermission(...permissions) };
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    const unauthenticated = error.code === "UNAUTHENTICATED";
    return {
      ok: false,
      response: NextResponse.json(
        { error: unauthenticated ? "No autenticado." : "No tienes permiso para realizar esta acción." },
        { status: unauthenticated ? 401 : 403 }
      ),
    };
  }
}
