import "server-only";
import { randomInt } from "crypto";
import { isCommonPassword } from "./common-passwords";
import { WORDLIST_ES } from "./wordlist-es";
import type { PasswordProfile } from "./password-policy";

/**
 * Generador asistido de contraseñas. Toda la aleatoriedad sale de
 * `crypto.randomInt` (CSPRNG); `Math.random` no se usa en ningún caso.
 *
 * Ni la palabra semilla ni la contraseña generada se registran en logs ni se
 * guardan: este módulo no escribe en consola ni en la base de datos.
 */

const DIGITS = "0123456789";
// Sin caracteres que se confunden al leerlos o dictarlos (0/O, 1/l/I).
const MIXED = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SEPARATORS = "-_.+";

const SEED_PATTERN = /^[a-z]{4,12}$/;

export class SeedWordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedWordError";
  }
}

/** Datos del titular, para impedir que la semilla sea adivinable. */
export interface SeedContext {
  fullName?: string | null;
  email?: string | null;
}

function pick(alphabet: string, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Fragmentos del nombre y del correo (usuario y dominio) del titular. */
function personalTokens(context: SeedContext): Set<string> {
  const tokens = new Set<string>();
  const source = `${context.fullName ?? ""} ${context.email ?? ""}`;
  for (const token of normalize(source).split(/[^a-z]+/)) {
    if (token.length >= 3) tokens.add(token);
  }
  return tokens;
}

/**
 * Valida la palabra semilla. Devuelve el mensaje de error o `null`.
 * Reglas: 4 a 12 letras a-z; no puede ser el nombre, el correo ni el dominio
 * del titular, ni contener "htl", ni estar entre las contraseñas comunes.
 */
export function validateSeedWord(word: string, context: SeedContext = {}): string | null {
  if (typeof word !== "string" || !SEED_PATTERN.test(word)) {
    return "La palabra debe tener entre 4 y 12 letras, solo de la a a la z (sin tildes, ñ, números ni espacios).";
  }
  if (word.includes("htl")) {
    return "La palabra no puede hacer referencia a la empresa.";
  }
  if (personalTokens(context).has(word)) {
    return "La palabra no puede ser el nombre, el correo ni el dominio del usuario.";
  }
  if (isCommonPassword(word)) {
    return "Esa palabra es demasiado común como contraseña. Elige otra.";
  }
  return null;
}

/**
 * Construye una contraseña alrededor de una palabra fácil de recordar.
 *
 *   staff:  Palabra + separador + 4 dígitos + separador + 5 caracteres
 *           (≥ 15 caracteres, ~44 bits aleatorios además de la palabra)
 *   portal: Palabra + separador + 6 dígitos
 *           (≥ 11 caracteres, ~22 bits; pensada para dictarse por teléfono)
 *
 * La palabra aporta memorabilidad, no seguridad: la fortaleza está en la
 * parte aleatoria, por eso dos llamadas con la misma palabra difieren.
 */
export function generatePasswordFromWord(
  word: string,
  profile: PasswordProfile,
  context: SeedContext = {}
): string {
  const error = validateSeedWord(word, context);
  if (error) throw new SeedWordError(error);

  const head = capitalize(word);
  if (profile === "portal") {
    return `${head}${pick(SEPARATORS, 1)}${pick(DIGITS, 6)}`;
  }
  return `${head}${pick(SEPARATORS, 1)}${pick(DIGITS, 4)}${pick(SEPARATORS, 1)}${pick(MIXED, 5)}`;
}

/** Palabra al azar de la lista en español, válida como semilla. */
export function suggestSeedWord(context: SeedContext = {}): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const word = WORDLIST_ES[randomInt(WORDLIST_ES.length)];
    if (validateSeedWord(word, context) === null) return word;
  }
  throw new Error("No se pudo sugerir una palabra.");
}

/**
 * Frase de 4 palabras distintas de la lista más 2 dígitos, por ejemplo
 * `Faro-tinta-huerto-nube-47` (~43 bits con una lista de ~570 palabras).
 */
export function generatePassphrase(): string {
  const words: string[] = [];
  while (words.length < 4) {
    const word = WORDLIST_ES[randomInt(WORDLIST_ES.length)];
    if (!words.includes(word)) words.push(word);
  }
  words[0] = capitalize(words[0]);
  return `${words.join("-")}-${pick(DIGITS, 2)}`;
}
