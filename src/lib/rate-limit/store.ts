/** Clave de un contador de intentos: ámbito + IP + identificador. */
export interface RateLimitKey {
  /** Qué login es: "staff" o "portal". */
  scope: string;
  ip: string;
  /** Correo (personal) o id de la sede (portal), ya normalizado. */
  identifier: string;
}

/**
 * Almacén de fallos de inicio de sesión. En producción debe ser compartido
 * entre instancias (ver `TursoRateLimitStore`); el de memoria solo sirve
 * para desarrollo y tests.
 */
export interface RateLimitStore {
  /** Instantes (segundos Unix) de los fallos registrados desde `since`. */
  failuresSince(key: RateLimitKey, since: number): Promise<number[]>;
  recordFailure(key: RateLimitKey, at: number): Promise<void>;
  /** Borra el historial de la clave (inicio de sesión correcto). */
  clear(key: RateLimitKey): Promise<void>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly failures = new Map<string, number[]>();

  private id(key: RateLimitKey): string {
    return JSON.stringify([key.scope, key.ip, key.identifier]);
  }

  async failuresSince(key: RateLimitKey, since: number): Promise<number[]> {
    return (this.failures.get(this.id(key)) ?? []).filter((time) => time >= since);
  }

  async recordFailure(key: RateLimitKey, at: number): Promise<void> {
    const id = this.id(key);
    this.failures.set(id, [...(this.failures.get(id) ?? []), at]);
  }

  async clear(key: RateLimitKey): Promise<void> {
    this.failures.delete(this.id(key));
  }
}
