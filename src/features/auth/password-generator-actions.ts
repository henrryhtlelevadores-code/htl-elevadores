"use server";

import { denyUnless } from "./guard";
import {
  generatePassphrase,
  generatePasswordFromWord,
  SeedWordError,
  suggestSeedWord,
} from "@/lib/password-generator";
import type { PasswordProfile } from "@/lib/password-policy";

export type GeneratePasswordInput =
  | { mode: "word"; word: string; profile: PasswordProfile; fullName?: string; email?: string }
  | { mode: "suggested"; profile: PasswordProfile; fullName?: string; email?: string }
  | { mode: "passphrase" };

export type GeneratePasswordResult =
  | { success: true; password: string; word?: string }
  | { success: false; error: string };

/**
 * Genera una contraseña para asignarla a un usuario o a una sede. Se hace en
 * servidor porque la aleatoriedad sale de `crypto.randomInt`.
 *
 * No se registra ni se guarda nada: ni la palabra semilla ni el resultado.
 * Por eso aquí no hay `console.*` ni escrituras en la base.
 */
export async function generatePasswordAction(
  input: GeneratePasswordInput
): Promise<GeneratePasswordResult> {
  // Solo quien puede fijar contraseñas (de personal o de sedes).
  const denied = await denyUnless("users:write", "clients:write");
  if (denied) return denied;

  try {
    if (input?.mode === "passphrase") {
      return { success: true, password: generatePassphrase() };
    }
    const profile: PasswordProfile = input?.profile === "portal" ? "portal" : "staff";
    const context = { fullName: input?.fullName, email: input?.email };
    if (input?.mode === "suggested") {
      const word = suggestSeedWord(context);
      return { success: true, word, password: generatePasswordFromWord(word, profile, context) };
    }
    if (input?.mode === "word") {
      const word = String(input.word ?? "").trim().toLowerCase();
      return { success: true, word, password: generatePasswordFromWord(word, profile, context) };
    }
    return { success: false, error: "Modo de generación no válido." };
  } catch (error) {
    if (error instanceof SeedWordError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "No se pudo generar la contraseña." };
  }
}
