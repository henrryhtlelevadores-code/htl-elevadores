"use server";

import { revalidatePath } from "next/cache";
import { hash, verify } from "@node-rs/argon2";
import {
  db,
  users,
  staffProfiles,
  roles,
  type User,
  type Role,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import { ARGON2ID_PARAMS, requiresRehash } from "./password";
import {
  createUserFormSchema,
  updateUserFormSchema,
  changeUserPasswordSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
  type ChangeUserPasswordValues,
} from "./schema";
import { and, asc, eq, isNull } from "drizzle-orm";

export type UserListItem = Omit<User, "passwordHash"> & {
  role_name?: string | null;
  specialization?: string | null;
  documentNumber?: string | null;
};

// ==========================================
// ROLES
// ==========================================

export async function getAllRoles(): Promise<Role[]> {
  try {
    return await db
      .select()
      .from(roles)
      .orderBy(asc(roles.name));
  } catch (error) {
    console.error("Error al obtener roles:", error);
    return [];
  }
}

export async function ensureDefaultRoles() {
  try {
    const existing = await db.select({ id: roles.id }).from(roles).limit(1);
    if (existing.length > 0) return;

    const defaultRoles = [
      { name: "ADMINISTRADOR", permissions: ["*"] },
      { name: "SUPERVISOR", permissions: ["work_orders", "reports", "users:read"] },
      { name: "TECNICO DE CAMPO", permissions: ["work_orders", "safety"] },
      { name: "SOPORTE", permissions: ["work_orders:read"] },
    ];

    await db.insert(roles).values(
      defaultRoles.map((r) => ({
        id: generateUuid(),
        name: r.name,
        permissions: r.permissions,
      }))
    );
  } catch (error) {
    console.error("Error al inicializar roles:", error);
  }
}

// ==========================================
// USUARIOS (PERSONAL)
// ==========================================

export async function getUsers(): Promise<UserListItem[]> {
  try {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        phone: users.phone,
        roleId: users.roleId,
        status: users.status,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
        role_name: roles.name,
        specialization: staffProfiles.specialization,
        documentNumber: staffProfiles.documentNumber,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .where(isNull(users.deletedAt))
      .orderBy(asc(users.fullName));

    return rows;
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    return [];
  }
}

export interface UserSummary {
  fullName: string;
  roleName: string | null;
}

export async function getUserSummary(userId: string): Promise<UserSummary | null> {
  try {
    const rows = await db
      .select({ fullName: users.fullName, role_name: roles.name })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { fullName: row.fullName, roleName: row.role_name };
  } catch (error) {
    console.error("Error al obtener resumen del usuario:", error);
    return null;
  }
}

export async function getUserRoleName(userId: string): Promise<string | null> {
  const summary = await getUserSummary(userId);
  return summary?.roleName ?? null;
}

export async function createUser(data: CreateUserFormValues) {
  try {
    const validated = createUserFormSchema.parse(data);

    const passwordHash = await hash(validated.password, ARGON2ID_PARAMS);
    const userId = generateUuid();

    await db.insert(users).values({
      id: userId,
      email: validated.email.trim().toLowerCase(),
      passwordHash,
      fullName: validated.fullName.trim(),
      phone: validated.phone?.trim() || null,
      roleId: validated.roleId,
      status: validated.status,
    });

    await db.insert(staffProfiles).values({
      userId,
      documentType: validated.documentType,
      documentNumber: validated.documentNumber.trim(),
      specialization: validated.specialization?.trim() || null,
      licenseNumber: validated.licenseNumber?.trim() || null,
    });

    revalidatePath("/users");
    revalidatePath("/work-orders");
    return { success: true, message: "Usuario creado correctamente" };
  } catch (error) {
    console.error("Error al crear usuario:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El correo electrónico ya está registrado." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateUser(id: string, data: UpdateUserFormValues) {
  try {
    const validated = updateUserFormSchema.parse(data);

    const user: Partial<User & { passwordHash: string }> = {
      email: validated.email.trim().toLowerCase(),
      fullName: validated.fullName.trim(),
      phone: validated.phone?.trim() || null,
      roleId: validated.roleId,
      status: validated.status,
    };

    const password = validated.password || "";
    if (password) {
      user.passwordHash = await hash(password, ARGON2ID_PARAMS);
    }

    await db.update(users).set(user).where(eq(users.id, id));

    await db
      .insert(staffProfiles)
      .values({
        userId: id,
        documentType: validated.documentType,
        documentNumber: validated.documentNumber.trim(),
        specialization: validated.specialization?.trim() || null,
        licenseNumber: validated.licenseNumber?.trim() || null,
      })
      .onConflictDoUpdate({
        target: staffProfiles.userId,
        set: {
          documentType: validated.documentType,
          documentNumber: validated.documentNumber.trim(),
          specialization: validated.specialization?.trim() || null,
          licenseNumber: validated.licenseNumber?.trim() || null,
        },
      });

    revalidatePath("/users");
    revalidatePath("/work-orders");
    return { success: true, message: "Usuario actualizado correctamente" };
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El correo electrónico ya está en uso." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function changeUserPassword(id: string, data: ChangeUserPasswordValues) {
  try {
    const validated = changeUserPasswordSchema.parse(data);

    const passwordHash = await hash(validated.password, ARGON2ID_PARAMS);
    await db.update(users).set({ passwordHash }).where(and(eq(users.id, id), isNull(users.deletedAt)));

    revalidatePath("/users");
    return { success: true, message: "Contraseña actualizada correctamente" };
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteUser(id: string) {
  try {
    await db
      .update(users)
      .set({ deletedAt: Math.floor(Date.now() / 1000), status: "INACTIVE" })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    revalidatePath("/users");
    revalidatePath("/work-orders");
    return { success: true, message: "Usuario eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// AUXILIARES DE SEGURIDAD (login)
// ==========================================

export async function verifyCredentials(
  email: string,
  password: string
): Promise<string | null> {
  try {
    const rows = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(and(eq(users.email, email.toLowerCase().trim()), isNull(users.deletedAt)))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    const valid = await verify(row.passwordHash, password);
    if (!valid) return null;

    // Si el hash no cumple la política actual (Argon2id m=64MB, t=3, p=4),
    // se re-hashea automáticamente con los parámetros vigentes.
    if (requiresRehash(row.passwordHash)) {
      const passwordHash = await hash(password, ARGON2ID_PARAMS);
      await db
        .update(users)
        .set({ passwordHash, lastLoginAt: Math.floor(Date.now() / 1000) })
        .where(eq(users.id, row.id));
      return row.id;
    }

    await db
      .update(users)
      .set({ lastLoginAt: Math.floor(Date.now() / 1000) })
      .where(eq(users.id, row.id));

    return row.id;
  } catch (error) {
    console.error("Error al verificar credenciales:", error);
    return null;
  }
}