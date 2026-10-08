import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, roles, users } from "@/db/index";
import { generateUuid } from "@/lib/uuid";

/**
 * Consultas internas de usuarios. Viven fuera de los archivos "use server"
 * para que no queden expuestas como endpoints: solo las invoca código de
 * servidor que ya validó (o está estableciendo) la sesión.
 */

/** Roles que habilitan el perfil de técnico en el formulario de usuarios. */
const FIELD_ROLE_NAMES = ["TECNICO DE CAMPO", "SUPERVISOR"];

export async function ensureDefaultRoles() {
  try {
    const existing = await db.select({ id: roles.id }).from(roles).limit(1);

    if (existing.length === 0) {
      // Ver src/features/auth/permissions.ts para el formato de permisos.
      const defaultRoles = [
        { name: "ADMINISTRADOR", permissions: ["*"], isFieldRole: false },
        {
          name: "SUPERVISOR",
          permissions: ["work_orders", "reports", "users:read"],
          isFieldRole: true,
        },
        {
          name: "TECNICO DE CAMPO",
          permissions: ["work_orders:field", "safety"],
          isFieldRole: true,
        },
        { name: "SOPORTE", permissions: ["work_orders:panel:read"], isFieldRole: false },
      ];

      await db.insert(roles).values(
        defaultRoles.map((r) => ({
          id: generateUuid(),
          name: r.name,
          permissions: r.permissions,
          isFieldRole: r.isFieldRole,
        }))
      );
    }

    // Respaldo idempotente por si la migración 0022 no llegó a aplicarse.
    await db
      .update(roles)
      .set({ isFieldRole: true })
      .where(inArray(roles.name, FIELD_ROLE_NAMES));
  } catch (error) {
    console.error("Error al inicializar roles:", error);
  }
}

export async function getUserRoleName(userId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ roleName: roles.name })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    return row?.roleName ?? null;
  } catch (error) {
    console.error("Error al obtener el rol del usuario:", error);
    return null;
  }
}
