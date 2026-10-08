"use server";

import { revalidatePath } from "next/cache";
import { hash } from "@node-rs/argon2";
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
import { uploadToR2, deleteR2ObjectByUrl, buildStaffSignatureKey } from "@/lib/r2";
import { ARGON2ID_PARAMS } from "./password";
import {
  createUserFormSchema,
  updateUserFormSchema,
  changeUserPasswordSchema,
  type CreateUserFormValues,
  type UpdateUserFormValues,
  type ChangeUserPasswordValues,
} from "./schema";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createSession, getSessionUserId } from "@/features/auth/server";
import { denyUnless, requirePermission } from "@/features/auth/guard";

/** Roles que habilitan el perfil de técnico en el formulario de usuarios. */
const FIELD_ROLE_NAMES = ["TECNICO DE CAMPO", "SUPERVISOR"];

const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024;

/** True si el rol corresponde a personal de campo (perfil de técnico). */
async function isFieldRole(roleId: string): Promise<boolean> {
  const rows = await db
    .select({ isFieldRole: roles.isFieldRole, name: roles.name })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);
  const role = rows[0];
  if (!role) return false;
  // Respaldo por nombre si is_field_role no se aplicó en la base actual.
  return role.isFieldRole === true || FIELD_ROLE_NAMES.includes(role.name);
}

/** Mapea los campos del formulario a columnas de staff_profiles. */
function staffProfileFields(data: {
  providerType: "INTERNAL" | "EXTERNAL";
  providerCompany?: string | null;
  hasSctr?: boolean | null;
  sctrExpiryDate?: string | null;
  baseSalary?: string | null;
  signatureUrl?: string | null;
}) {
  return {
    providerType: data.providerType,
    providerCompany: data.providerType === "EXTERNAL"
      ? data.providerCompany?.trim() || null
      : null,
    hasSctr: data.hasSctr ?? false,
    // Epoch ms en UTC; el DatePicker trabaja con YYYY-MM-DD.
    sctrExpiryDate: data.hasSctr && data.sctrExpiryDate
      ? Date.parse(`${data.sctrExpiryDate}T00:00:00Z`)
      : null,
    baseSalary: data.baseSalary && data.baseSalary !== ""
      ? Number(data.baseSalary)
      : null,
    signatureUrl: data.signatureUrl?.trim() || null,
  };
}

export type UserListItem = Omit<User, "passwordHash" | "sessionVersion"> & {
  role_name?: string | null;
  isFieldRole?: boolean | null;
  specialization?: string | null;
  documentType?: string | null;
  documentNumber?: string | null;
  licenseNumber?: string | null;
  providerType?: string | null;
  providerCompany?: string | null;
  hasSctr?: boolean | null;
  sctrExpiryDate?: number | null;
  baseSalary?: number | null;
  signatureUrl?: string | null;
};

// ==========================================
// ROLES
// ==========================================

export async function getAllRoles(): Promise<Role[]> {
  await requirePermission("users:read");
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


// ==========================================
// USUARIOS (PERSONAL)
// ==========================================

export async function getUsers(): Promise<UserListItem[]> {
  await requirePermission("users:read");
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
        isFieldRole: roles.isFieldRole,
        specialization: staffProfiles.specialization,
        documentType: staffProfiles.documentType,
        documentNumber: staffProfiles.documentNumber,
        licenseNumber: staffProfiles.licenseNumber,
        providerType: staffProfiles.providerType,
        providerCompany: staffProfiles.providerCompany,
        hasSctr: staffProfiles.hasSctr,
        sctrExpiryDate: staffProfiles.sctrExpiryDate,
        baseSalary: staffProfiles.baseSalary,
        signatureUrl: staffProfiles.signatureUrl,
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

export async function createUser(data: CreateUserFormValues) {
  const denied = await denyUnless("users:write");
  if (denied) return denied;
  try {
    const validated = createUserFormSchema.parse(data);

    const passwordHash = await hash(validated.password, ARGON2ID_PARAMS);
    const userId = generateUuid();

    const isField = await isFieldRole(validated.roleId);
    if (!isField && validated.providerType === "EXTERNAL") {
      return {
        success: false,
        error: "El tipo de trabajador solo aplica a roles de personal de campo.",
      };
    }
    if (isField && validated.providerType === "EXTERNAL" && !validated.providerCompany?.trim()) {
      return {
        success: false,
        error: "La empresa proveedora es obligatoria para proveedores externos.",
      };
    }
    if (isField && validated.hasSctr && !validated.sctrExpiryDate) {
      return {
        success: false,
        error: "Indica la fecha de vencimiento del SCTR.",
      };
    }

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
      ...(isField ? staffProfileFields(validated) : {}),
    });

    revalidatePath("/users");
    revalidatePath("/work-orders");
    revalidatePath("/routes");
    return { success: true, message: "Usuario creado correctamente" };
  } catch (error) {
    console.error("Error al crear usuario:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El correo electrónico ya está registrado." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Tras revocar las sesiones de un usuario, si quien hace el cambio es ese
 * mismo usuario se le reemite la cookie para no expulsarlo de su sesión
 * actual (las demás sí quedan cerradas).
 */
async function keepOwnSession(sessionUserId: string, targetUserId: string) {
  if (sessionUserId !== targetUserId) return;
  const [row] = await db
    .select({ sessionVersion: users.sessionVersion, status: users.status })
    .from(users)
    .where(and(eq(users.id, targetUserId), isNull(users.deletedAt)))
    .limit(1);
  if (row && row.status === "ACTIVE") {
    await createSession(targetUserId, row.sessionVersion);
  }
}

export async function updateUser(id: string, data: UpdateUserFormValues) {
  const denied = await denyUnless("users:write");
  if (denied) return denied;
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return { success: false, error: "Sesión requerida" };
  }
  try {
    const validated = updateUserFormSchema.parse(data);

    const isField = await isFieldRole(validated.roleId);
    if (isField && validated.providerType === "EXTERNAL" && !validated.providerCompany?.trim()) {
      return {
        success: false,
        error: "La empresa proveedora es obligatoria para proveedores externos.",
      };
    }
    if (isField && validated.hasSctr && !validated.sctrExpiryDate) {
      return {
        success: false,
        error: "Indica la fecha de vencimiento del SCTR.",
      };
    }

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

    const [current] = await db
      .select({ roleId: users.roleId, status: users.status })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    // Cambiar contraseña, rol o estado revoca las sesiones ya emitidas.
    const revokeSessions =
      Boolean(password) ||
      current?.roleId !== validated.roleId ||
      current?.status !== validated.status;

    await db
      .update(users)
      .set(revokeSessions ? { ...user, sessionVersion: sql`${users.sessionVersion} + 1` } : user)
      .where(eq(users.id, id));
    if (revokeSessions) {
      await keepOwnSession(sessionUserId, id);
    }

    const staffFields = isField
      ? staffProfileFields(validated)
      : // Fuera de roles de campo se conservan los datos ya guardados.
        {};

    await db
      .insert(staffProfiles)
      .values({
        userId: id,
        documentType: validated.documentType,
        documentNumber: validated.documentNumber.trim(),
        specialization: validated.specialization?.trim() || null,
        licenseNumber: validated.licenseNumber?.trim() || null,
        ...staffFields,
      })
      .onConflictDoUpdate({
        target: staffProfiles.userId,
        set: {
          documentType: validated.documentType,
          documentNumber: validated.documentNumber.trim(),
          specialization: validated.specialization?.trim() || null,
          licenseNumber: validated.licenseNumber?.trim() || null,
          ...staffFields,
        },
      });

    // Si se reemplazó la firma, el objeto anterior queda huérfano en R2.
    const previous = await db
      .select({ signatureUrl: staffProfiles.signatureUrl })
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, id))
      .limit(1);
    const previousUrl = previous[0]?.signatureUrl ?? null;
    const nextUrl = validated.signatureUrl?.trim() || null;
    if (previousUrl && previousUrl !== nextUrl) {
      await deleteR2ObjectByUrl(previousUrl).catch(() => undefined);
    }

    revalidatePath("/users");
    revalidatePath("/work-orders");
    revalidatePath("/routes");
    return { success: true, message: "Usuario actualizado correctamente" };
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El correo electrónico ya está en uso." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

/** Sube la firma del técnico a R2 y devuelve la URL pública. */
export async function uploadStaffSignature(dataUrl: string) {
  const denied = await denyUnless("users:write");
  if (denied) return denied;
  try {
    const match = /^data:(image\/(?:png|jpe?g));base64,(.+)$/i.exec(dataUrl ?? "");
    if (!match) {
      return { success: false, error: "Adjunta una imagen PNG o JPG válida." };
    }
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_SIGNATURE_BYTES) {
      return { success: false, error: "La firma supera los 5 MB." };
    }
    const url = await uploadToR2(
      buildStaffSignatureKey(generateUuid()),
      bytes,
      match[1]
    );
    return { success: true, url };
  } catch (error) {
    console.error("Error al subir la firma del técnico:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function changeUserPassword(id: string, data: ChangeUserPasswordValues) {
  const denied = await denyUnless("users:write");
  if (denied) return denied;
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) {
    return { success: false, error: "Sesión requerida" };
  }
  try {
    const validated = changeUserPasswordSchema.parse(data);

    const passwordHash = await hash(validated.password, ARGON2ID_PARAMS);
    // Cambiar la contraseña revoca las sesiones ya emitidas.
    await db
      .update(users)
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    await keepOwnSession(sessionUserId, id);

    revalidatePath("/users");
    return { success: true, message: "Contraseña actualizada correctamente" };
  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteUser(id: string) {
  const denied = await denyUnless("users:write");
  if (denied) return denied;
  try {
    await db
      .update(users)
      .set({
        deletedAt: Math.floor(Date.now() / 1000),
        status: "INACTIVE",
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));

    revalidatePath("/users");
    revalidatePath("/work-orders");
    return { success: true, message: "Usuario eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
