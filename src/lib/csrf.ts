/**
 * Verificación de origen para peticiones que cambian estado (defensa CSRF).
 * Lógica pura, usada desde `src/proxy.ts`.
 *
 * Los navegadores envían `Origin` en todo POST/PUT/PATCH/DELETE entre sitios
 * y `Sec-Fetch-Site` en los modernos. Un cliente que no envía ninguna de las
 * dos cabeceras no es un navegador (curl, una app nativa), y CSRF es un
 * ataque que solo existe en navegadores: esas peticiones pasan y se
 * autentican después por cookie o credencial como cualquier otra.
 */

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface OriginCheckInput {
  method: string;
  /** Host al que llegó la petición (cabecera Host o X-Forwarded-Host). */
  host: string | null;
  origin: string | null;
  secFetchSite: string | null;
}

/** `true` si la petición debe rechazarse por venir de otro origen. */
export function isCrossOriginMutation(input: OriginCheckInput): boolean {
  if (!UNSAFE_METHODS.has(input.method.toUpperCase())) return false;

  if (input.origin) {
    // "null" (iframes aislados, redirecciones opacas) nunca es nuestro origen.
    if (input.origin === "null" || !input.host) return true;
    try {
      return new URL(input.origin).host !== input.host;
    } catch {
      return true;
    }
  }

  return input.secFetchSite === "cross-site";
}
