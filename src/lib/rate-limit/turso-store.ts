import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, loginAttempts } from "@/db/index";
import type { RateLimitKey, RateLimitStore } from "./store";

/** Los fallos más antiguos que esto se eliminan al registrar uno nuevo. */
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

/**
 * Almacén sobre la tabla `login_attempts` de la base (Turso). Al vivir en la
 * base, el contador es común a todas las instancias de la aplicación.
 * libSQL no tiene TTL nativo, así que la purga se hace en el mismo flujo.
 */
export class TursoRateLimitStore implements RateLimitStore {
  private where(key: RateLimitKey) {
    return and(
      eq(loginAttempts.scope, key.scope),
      eq(loginAttempts.ip, key.ip),
      eq(loginAttempts.identifier, key.identifier)
    );
  }

  async failuresSince(key: RateLimitKey, since: number): Promise<number[]> {
    const rows = await db
      .select({ createdAt: loginAttempts.createdAt })
      .from(loginAttempts)
      .where(and(this.where(key), gte(loginAttempts.createdAt, since)))
      .orderBy(asc(loginAttempts.createdAt))
      .limit(500);
    return rows.map((row) => row.createdAt);
  }

  async recordFailure(key: RateLimitKey, at: number): Promise<void> {
    await db.insert(loginAttempts).values({
      scope: key.scope,
      ip: key.ip,
      identifier: key.identifier,
      createdAt: at,
    });
    // Purga global de registros caducados; barata gracias al índice por fecha.
    await db
      .delete(loginAttempts)
      .where(lt(loginAttempts.createdAt, at - RETENTION_SECONDS));
  }

  async clear(key: RateLimitKey): Promise<void> {
    await db.delete(loginAttempts).where(this.where(key));
  }
}
