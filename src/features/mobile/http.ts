import "server-only";
import { NextResponse } from "next/server";

/**
 * Error con el que el servicio móvil corta una petición. El estado HTTP le
 * dice a la cola de la app qué hacer:
 *
 *   401  sesión inválida: la cola se detiene hasta volver a iniciar sesión.
 *   4xx  la petición no es válida y reintentarla no la arregla.
 *   5xx  fallo temporal: la app reintenta más tarde.
 */
export class MobileError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "MobileError";
  }
}

export const unauthorized = (message = "Sesión inválida. Vuelve a iniciar sesión.") =>
  new MobileError(401, message);
export const forbidden = (message = "No tienes acceso a este recurso.") =>
  new MobileError(403, message);
export const notFound = (message = "No encontrado.") => new MobileError(404, message);
export const invalid = (message: string) => new MobileError(422, message);
export const unavailable = (message: string) => new MobileError(503, message);

const NO_STORE = { "Cache-Control": "private, no-store" };

export function ok(body: Record<string, unknown> = {}): NextResponse {
  return NextResponse.json({ success: true, ...body }, { headers: NO_STORE });
}

/**
 * Ejecuta un handler de la API móvil y traduce sus errores a JSON
 * `{ success: false, message }`. Un error inesperado responde 500 sin
 * detalles internos (y la app lo reintentará).
 */
export async function mobileRoute(run: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof MobileError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status, headers: NO_STORE }
      );
    }
    console.error("API móvil:", error);
    return NextResponse.json(
      { success: false, message: "Error interno. Inténtalo de nuevo." },
      { status: 500, headers: NO_STORE }
    );
  }
}

/** Cuerpo JSON como objeto; cualquier otra cosa es una petición inválida. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw invalid("El cuerpo de la petición no es válido.");
  }
  return body as Record<string, unknown>;
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Los IDs que genera la app deben ser UUID: se usan como claves primarias. */
export function requireUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw invalid(`${label} no es un identificador válido.`);
  }
  return value;
}

const MAX_PAST_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000;

/**
 * Hora en que el técnico hizo el cambio, según su teléfono (ms). Se respeta
 * porque el trabajo sin señal se sincroniza después, pero solo dentro de un
 * rango razonable: fuera de él (reloj mal puesto o dato manipulado) se usa
 * la hora del servidor.
 */
export function clientTime(value: unknown, now = Date.now()): number {
  const time = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(time)) return now;
  if (time > now + MAX_FUTURE_MS || time < now - MAX_PAST_MS) return now;
  return Math.trunc(time);
}

export function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, maxLength) || null;
}
