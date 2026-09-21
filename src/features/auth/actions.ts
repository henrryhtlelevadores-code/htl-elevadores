"use server";

import { verifyCredentials, getUserRoleName } from "@/features/users/actions";
import { createSession, destroySession } from "./server";
import { getErrorMessage } from "@/lib/errors";

const TECHNICIAN_ROLE = "TECNICO DE CAMPO";

export type LoginResult =
  | { success: true; message: string; redirectTo?: string }
  | { success: false; error: string };

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  try {
    const userId = await verifyCredentials(input.email, input.password);
    if (!userId) {
      return {
        success: false,
        error: "Credenciales inválidas. Verifica tu correo y contraseña.",
      };
    }

    await createSession(userId);

    const roleName = await getUserRoleName(userId);
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

export async function logoutAction() {
  await destroySession();
}