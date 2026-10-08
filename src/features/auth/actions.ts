"use server";

import { verifyCredentials } from "@/features/users/credentials";
import { getUserRoleName } from "@/features/users/queries";
import { createSession, destroySession } from "./server";
import { getErrorMessage } from "@/lib/errors";
import { getClientIp } from "@/lib/client-ip";
import {
  checkLoginAllowed,
  rateLimitMessage,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/rate-limit";

const TECHNICIAN_ROLE = "TECNICO DE CAMPO";

export type LoginResult =
  | { success: true; message: string; redirectTo?: string }
  | { success: false; error: string };

/** Pública por diseño: es la puerta de entrada del personal. */
export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  try {
    const email = String(input?.email ?? "").toLowerCase().trim().slice(0, 254);
    const password = String(input?.password ?? "");
    const key = { scope: "staff", ip: await getClientIp(), identifier: email };

    // Antes de Argon2: una petición bloqueada no llega a hashear.
    const limit = await checkLoginAllowed(key);
    if (!limit.allowed) {
      return { success: false, error: rateLimitMessage(limit.retryAfterSeconds) };
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      await recordLoginFailure(key);
      return {
        success: false,
        error: "Credenciales inválidas. Verifica tu correo y contraseña.",
      };
    }

    await recordLoginSuccess(key);
    await createSession(user.id, user.sessionVersion);

    const roleName = await getUserRoleName(user.id);
    const redirectTo =
      roleName === TECHNICIAN_ROLE ? "/technician/work-orders" : "/";

    return {
      success: true,
      message: "Sesión iniciada correctamente",
      redirectTo,
    };
  } catch (error) {
    console.error("Error en loginAction:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/** Pública por diseño: solo borra la cookie de quien la invoca. */
export async function logoutAction() {
  await destroySession();
}
