import { hash, parseOptions } from "@node-rs/argon2";

const ARGON2ID = 2;

// Parámetros Argon2id recomendados por OWASP:
// m=64MB, t=3, p=4
export const ARGON2ID_PARAMS = {
  algorithm: ARGON2ID,
  memoryCost: 64 * 1024, // 65536 KiB = 64 MiB
  timeCost: 3, // iteraciones
  parallelism: 4, // hilos
} as const;

/**
 * Hashea una contraseña con Argon2id usando la política de seguridad
 * recomendada por OWASP (m=64MB, t=3, p=4).
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2ID_PARAMS);
}

/**
 * Indica si un hash existente debe re-generarse por no cumplir la política actual.
 */
export function requiresRehash(passwordHash: string): boolean {
  try {
    const opts = parseOptions(passwordHash);
    return (
      opts.algorithm !== ARGON2ID ||
      opts.memoryCost !== ARGON2ID_PARAMS.memoryCost ||
      opts.timeCost !== ARGON2ID_PARAMS.timeCost ||
      opts.parallelism !== ARGON2ID_PARAMS.parallelism
    );
  } catch {
    return true;
  }
}