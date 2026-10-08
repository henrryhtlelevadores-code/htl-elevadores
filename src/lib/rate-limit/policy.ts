/**
 * Política de bloqueo progresivo de inicios de sesión. Lógica pura.
 *
 * 5 fallos dentro de 15 minutos bloquean 15 minutos. Cada nuevo bloqueo
 * dentro de las últimas 24 horas dura el doble que el anterior (30 min, 1 h,
 * 2 h…), con un tope de 24 horas. Un inicio de sesión correcto borra el
 * historial de esa clave.
 */
export const MAX_FAILURES = 5;
export const WINDOW_SECONDS = 15 * 60;
export const BASE_LOCK_SECONDS = 15 * 60;
export const MAX_LOCK_SECONDS = 24 * 60 * 60;
/** Cuánto historial de fallos se tiene en cuenta para el backoff. */
export const LOOKBACK_SECONDS = 24 * 60 * 60;

export interface RateLimitDecision {
  allowed: boolean;
  /** Segundos que faltan para poder reintentar (0 si está permitido). */
  retryAfterSeconds: number;
}

/**
 * Decide a partir de los instantes (segundos Unix) de los fallos registrados
 * en el periodo de lookback.
 */
export function evaluateFailures(failureTimes: readonly number[], now: number): RateLimitDecision {
  const times = [...failureTimes].sort((a, b) => a - b);
  let lockedUntil = 0;
  let locks = 0;
  let recent: number[] = [];

  for (const time of times) {
    recent = recent.filter((previous) => time - previous < WINDOW_SECONDS);
    recent.push(time);
    if (recent.length >= MAX_FAILURES) {
      locks += 1;
      const duration = Math.min(BASE_LOCK_SECONDS * 2 ** (locks - 1), MAX_LOCK_SECONDS);
      lockedUntil = time + duration;
      recent = [];
    }
  }

  const retryAfterSeconds = Math.max(0, lockedUntil - now);
  return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
}
