import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, isNull } from "drizzle-orm";
import { db, users } from "@/db/index";
import { ARGON2ID_PARAMS, requiresRehash } from "./password";

export interface VerifiedUser {
  id: string;
  sessionVersion: number;
}

/**
 * Comprueba correo y contraseña del personal. Vive fuera de los archivos
 * "use server" a propósito: no debe quedar expuesto como endpoint, solo lo
 * usa `loginAction` (que aplica el rate limit).
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<VerifiedUser | null> {
  try {
    const rows = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        status: users.status,
        sessionVersion: users.sessionVersion,
      })
      .from(users)
      .where(and(eq(users.email, email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const valid = await verify(row.passwordHash, password);
    if (!valid) return null;

    // Un usuario desactivado no puede iniciar sesión aunque acierte la clave.
    if (row.status !== "ACTIVE") return null;

    const update: { lastLoginAt: number; passwordHash?: string } = {
      lastLoginAt: Math.floor(Date.now() / 1000),
    };
    // Si el hash no cumple la política actual (Argon2id m=64MB, t=3, p=4),
    // se re-hashea automáticamente con los parámetros vigentes.
    if (requiresRehash(row.passwordHash)) {
      update.passwordHash = await hash(password, ARGON2ID_PARAMS);
    }
    await db.update(users).set(update).where(eq(users.id, row.id));

    return { id: row.id, sessionVersion: row.sessionVersion };
  } catch (error) {
    console.error("Error al verificar credenciales:", error);
    return null;
  }
}
