import "server-only";
import { evaluateFailures, LOOKBACK_SECONDS, type RateLimitDecision } from "./policy";
import { MemoryRateLimitStore, type RateLimitKey, type RateLimitStore } from "./store";
import { TursoRateLimitStore } from "./turso-store";

let store: RateLimitStore | null = null;

/**
 * Almacén activo. Por defecto: base de datos en producción y memoria en el
 * resto. `RATE_LIMIT_STORE=turso|memory` lo fuerza. El de memoria no se
 * comparte entre instancias: no debe usarse en producción.
 */
export function getRateLimitStore(): RateLimitStore {
  if (!store) {
    const kind =
      process.env.RATE_LIMIT_STORE ??
      (process.env.NODE_ENV === "production" ? "turso" : "memory");
    store = kind === "memory" ? new MemoryRateLimitStore() : new TursoRateLimitStore();
  }
  return store;
}

/** Solo para tests. */
export function setRateLimitStore(next: RateLimitStore | null) {
  store = next;
}

const now = () => Math.floor(Date.now() / 1000);

/** ¿Puede intentarse el inicio de sesión? Llamar ANTES de verificar la clave. */
export async function checkLoginAllowed(key: RateLimitKey): Promise<RateLimitDecision> {
  const current = now();
  const failures = await getRateLimitStore().failuresSince(key, current - LOOKBACK_SECONDS);
  return evaluateFailures(failures, current);
}

export async function recordLoginFailure(key: RateLimitKey): Promise<void> {
  await getRateLimitStore().recordFailure(key, now());
}

export async function recordLoginSuccess(key: RateLimitKey): Promise<void> {
  await getRateLimitStore().clear(key);
}

export function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return minutes >= 120
    ? `Demasiados intentos fallidos. Vuelve a intentarlo en ${Math.ceil(minutes / 60)} horas.`
    : `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutes} minuto${minutes === 1 ? "" : "s"}.`;
}

export type { RateLimitKey } from "./store";
