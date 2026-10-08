import "server-only";
import { verify } from "@node-rs/argon2";
import { and, eq, isNull } from "drizzle-orm";
import { db, costCenters } from "@/db/index";

export type VerifyCostCenterCredentialResult =
  | { success: true; costCenter: { id: string; sessionVersion: number } }
  | { success: false; error: string };

/**
 * Comprueba la credencial del portal de una sede. Vive fuera de los archivos
 * "use server" a propósito: no debe quedar expuesto como endpoint, solo lo
 * usa `portalLoginAction` (que aplica el rate limit).
 */
export async function verifyCostCenterCredentials(
  costCenterId: string,
  plainTextPin: string
): Promise<VerifyCostCenterCredentialResult> {
  try {
    const rows = await db
      .select({
        id: costCenters.id,
        passwordHash: costCenters.passwordHash,
        portalSessionVersion: costCenters.portalSessionVersion,
      })
      .from(costCenters)
      .where(and(eq(costCenters.id, costCenterId), isNull(costCenters.deletedAt)))
      .limit(1);

    if (rows.length === 0) {
      return { success: false, error: "El código del edificio no existe." };
    }

    const row = rows[0];
    if (!row.passwordHash) {
      return { success: false, error: "Este edificio aún no tiene credenciales configuradas." };
    }

    const valid = await verify(row.passwordHash, plainTextPin);
    if (!valid) {
      return { success: false, error: "Contraseña incorrecta." };
    }

    return {
      success: true,
      costCenter: { id: row.id, sessionVersion: row.portalSessionVersion },
    };
  } catch (error) {
    console.error("Error al verificar credenciales del edificio:", error);
    return { success: false, error: "Error al verificar las credenciales." };
  }
}
