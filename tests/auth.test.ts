import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, roles, users } from "@/db";
import { loginAction } from "@/features/auth/actions";
import { getSessionUser } from "@/features/auth/server";
import { AuthError } from "@/features/auth/guard";
import { SESSION_COOKIE } from "@/features/auth/session";
import { PORTAL_SESSION_COOKIE } from "@/features/portal/session";
import { changeUserPassword, deleteUser, getUsers, updateUser } from "@/features/users/actions";
import { MemoryRateLimitStore } from "@/lib/rate-limit/store";
import { setRateLimitStore } from "@/lib/rate-limit";
import { cookieJar, resetRequest } from "./helpers/request";
import {
  STAFF_PASSWORD,
  createCostCenter,
  createRole,
  createUser,
  loginAs,
  loginPortal,
} from "./helpers/fixtures";

const NEW_PASSWORD = { password: "Otra-Clave-7391", confirmPassword: "Otra-Clave-7391" };

/** Datos mínimos válidos para `updateUser`. */
function userForm(user: { email: string; roleId: string }, overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Usuario De Prueba",
    email: user.email,
    phone: "",
    roleId: user.roleId,
    status: "ACTIVE" as const,
    documentType: "DNI" as const,
    documentNumber: "12345678",
    providerType: "INTERNAL" as const,
    hasSctr: false,
    password: "",
    ...overrides,
  } as Parameters<typeof updateUser>[1];
}

beforeEach(() => {
  resetRequest();
  setRateLimitStore(new MemoryRateLimitStore());
});

describe("inicio de sesión", () => {
  it("un usuario activo obtiene sesión", async () => {
    const user = await createUser({ permissions: ["users:read"] });
    const result = await loginAction({ email: user.email, password: STAFF_PASSWORD });
    expect(result.success).toBe(true);
    expect((await getSessionUser())?.id).toBe(user.id);
  });

  it("un usuario INACTIVE no obtiene sesión aunque la contraseña sea correcta", async () => {
    const user = await createUser({ permissions: ["*"], status: "INACTIVE" });
    const result = await loginAction({ email: user.email, password: STAFF_PASSWORD });
    expect(result.success).toBe(false);
    expect(cookieJar.get(SESSION_COOKIE)).toBeUndefined();
    expect(await getSessionUser()).toBeNull();
  });
});

describe("resolución de la sesión", () => {
  it("la cookie del portal no sirve como sesión de personal", async () => {
    const costCenter = await createCostCenter();
    await loginPortal(costCenter.id);
    const portalToken = cookieJar.get(PORTAL_SESSION_COOKIE)!.value;

    // El ataque de la auditoría: copiar la cookie del portal a la de personal.
    cookieJar.set(SESSION_COOKIE, portalToken);
    expect(await getSessionUser()).toBeNull();
    await expect(getUsers()).rejects.toBeInstanceOf(AuthError);
  });

  it("un token válido de un usuario inexistente no da sesión", async () => {
    await loginAs((await createUser({ permissions: ["*"] })).id);
    const user = await getSessionUser();
    await db.delete(users).where(eq(users.id, user!.id));
    expect(await getSessionUser()).toBeNull();
  });

  it("desactivar al usuario invalida su sesión abierta", async () => {
    const user = await createUser({ permissions: ["*"] });
    await loginAs(user.id);
    expect(await getSessionUser()).not.toBeNull();
    await db.update(users).set({ status: "INACTIVE" }).where(eq(users.id, user.id));
    expect(await getSessionUser()).toBeNull();
  });
});

describe("revocación por session_version", () => {
  async function sessionVersion(userId: string) {
    const [row] = await db
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId));
    return row.sessionVersion;
  }

  it("cambiar la contraseña cierra las sesiones del usuario", async () => {
    const admin = await createUser({ permissions: ["*"] });
    const target = await createUser({ permissions: ["users:read"] });

    await loginAs(target.id);
    const targetToken = cookieJar.get(SESSION_COOKIE)!.value;

    await loginAs(admin.id);
    const result = await changeUserPassword(target.id, NEW_PASSWORD);
    expect(result.success).toBe(true);
    expect(await sessionVersion(target.id)).toBe(1);

    resetRequest();
    cookieJar.set(SESSION_COOKIE, targetToken);
    expect(await getSessionUser()).toBeNull();
  });

  it("cambiar el rol incrementa la versión y cierra las sesiones", async () => {
    const admin = await createUser({ permissions: ["*"] });
    const target = await createUser({ permissions: ["users:read"] });
    const otherRole = await createRole("OTRO", ["reports:read"]);

    await loginAs(target.id);
    const targetToken = cookieJar.get(SESSION_COOKIE)!.value;

    await loginAs(admin.id);
    const result = await updateUser(target.id, userForm(target, { roleId: otherRole }));
    expect(result.success).toBe(true);
    expect(await sessionVersion(target.id)).toBe(1);

    resetRequest();
    cookieJar.set(SESSION_COOKIE, targetToken);
    expect(await getSessionUser()).toBeNull();
  });

  it("editar datos sin tocar rol, estado ni contraseña conserva la sesión", async () => {
    const admin = await createUser({ permissions: ["*"] });
    const target = await createUser({ permissions: ["users:read"] });
    await loginAs(admin.id);
    const result = await updateUser(target.id, userForm(target, { fullName: "Nombre Nuevo" }));
    expect(result.success).toBe(true);
    expect(await sessionVersion(target.id)).toBe(0);
  });

  it("quien cambia su propia contraseña conserva la sesión actual", async () => {
    const admin = await createUser({ permissions: ["*"] });
    await loginAs(admin.id);
    expect((await changeUserPassword(admin.id, NEW_PASSWORD)).success).toBe(true);
    expect((await getSessionUser())?.id).toBe(admin.id);
  });
});

describe("permisos en acciones de usuarios", () => {
  it("getUsers sin sesión falla", async () => {
    await expect(getUsers()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("getUsers con sesión pero sin permiso falla", async () => {
    await loginAs((await createUser({ permissions: ["reports"] })).id);
    await expect(getUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("getUsers con users:read funciona", async () => {
    await loginAs((await createUser({ permissions: ["users:read"] })).id);
    expect(Array.isArray(await getUsers())).toBe(true);
  });

  it("un técnico de campo no puede eliminar usuarios ni cambiar contraseñas", async () => {
    const admin = await createUser({ permissions: ["*"] });
    const technician = await createUser({ permissions: ["work_orders:field", "safety"] });
    await loginAs(technician.id);

    const deleted = await deleteUser(admin.id);
    expect(deleted.success).toBe(false);
    const changed = await changeUserPassword(admin.id, NEW_PASSWORD);
    expect(changed.success).toBe(false);

    const [row] = await db
      .select({ deletedAt: users.deletedAt, sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, admin.id));
    expect(row.deletedAt).toBeNull();
    expect(row.sessionVersion).toBe(0);
  });

  it("users:read no basta para escribir", async () => {
    const target = await createUser({ permissions: [] });
    await loginAs((await createUser({ permissions: ["users:read"] })).id);
    expect((await deleteUser(target.id)).success).toBe(false);
  });

  it("un rol desactivado no concede permisos", async () => {
    const user = await createUser({ permissions: ["*"] });
    await db.update(roles).set({ isActive: false }).where(eq(roles.id, user.roleId));
    await loginAs(user.id);
    await expect(getUsers()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("las contraseñas comunes o cortas se rechazan en servidor", async () => {
    const admin = await createUser({ permissions: ["*"] });
    const target = await createUser({ permissions: [] });
    await loginAs(admin.id);
    const common = await changeUserPassword(target.id, {
      password: "1234567890",
      confirmPassword: "1234567890",
    });
    expect(common.success).toBe(false);
    // El aviso de "generada" no exime de la lista de contraseñas comunes.
    const flagged = await changeUserPassword(
      target.id,
      { password: "1234567890", confirmPassword: "1234567890" },
      { passwordGenerated: true }
    );
    expect(flagged.success).toBe(false);
  });
});
