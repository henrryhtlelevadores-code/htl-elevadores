import "server-only";
import { isCommonPassword } from "./common-passwords";

/** `staff`: personal del panel. `portal`: credencial de una sede. */
export type PasswordProfile = "staff" | "portal";

export const PASSWORD_MIN_LENGTH: Record<PasswordProfile, number> = {
  staff: 10,
  portal: 6,
};

export const PASSWORD_MAX_LENGTH = 100;

/** Clases de caracteres exigidas a una contraseña escrita a mano. */
const REQUIRED_CLASSES: Record<PasswordProfile, number> = {
  staff: 3,
  portal: 2,
};

function characterClasses(password: string): number {
  return [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
}

/**
 * Valida una contraseña nueva. Devuelve el mensaje de error o `null`.
 *
 * `generated` indica que salió del generador asistido. Como ese dato llega
 * del cliente no es de fiar: solo exime de la regla de composición. La
 * longitud mínima y la lista de contraseñas comunes se comprueban siempre.
 */
export function validateNewPassword(
  password: string,
  profile: PasswordProfile,
  options: { generated?: boolean } = {}
): string | null {
  const min = PASSWORD_MIN_LENGTH[profile];
  if (typeof password !== "string" || password.length < min) {
    return `La contraseña debe tener al menos ${min} caracteres.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  if (isCommonPassword(password)) {
    return "Esa contraseña es demasiado común. Elige otra o usa el generador.";
  }
  if (!options.generated && characterClasses(password) < REQUIRED_CLASSES[profile]) {
    return profile === "staff"
      ? "Combina al menos tres de: minúsculas, mayúsculas, números y símbolos."
      : "Combina al menos dos de: minúsculas, mayúsculas, números y símbolos.";
  }
  return null;
}
