"use server";

import { verifyCredentials } from "@/features/users/credentials";
import { getUserRoleName } from "@/features/users/actions";
import { createSession, destroySession } from "./server";
import { getErrorMessage } from "@/lib/errors";

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
    const user = await verifyCredentials(input.email, input.password);
    if (!user) {
      return {
        success: false,
        error: "Credenciales inválidas. Verifica tu correo y contraseña.",
      };
    }

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
