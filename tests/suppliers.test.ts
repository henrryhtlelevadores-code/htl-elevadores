import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, roles, staffProfiles, suppliers, users } from "@/db";
import { createSupplier, deleteSupplier, updateSupplier } from "@/features/masters/actions";
import { createUser as createStaffUser } from "@/features/users/actions";
import { createUser, loginAs } from "./helpers/fixtures";

const supplierForm = (overrides: Record<string, unknown> = {}) => ({
  name: `Limpieza ${randomUUID().slice(0, 8)}`,
  taxId: "",
  contactName: "",
  phone: "",
  email: "",
  isActive: true,
  ...overrides,
});

async function fieldRole() {
  const id = randomUUID().toUpperCase();
  await db.insert(roles).values({ id, name: `CAMPO-${id.slice(0, 8)}`, permissions: [], isFieldRole: true });
  return id;
}

const staffForm = (roleId: string, overrides: Record<string, unknown> = {}) =>
  ({
    fullName: "Limpieza Total SAC",
    email: `cuenta-${randomUUID().slice(0, 8)}@example.test`,
    phone: "",
    roleId,
    status: "ACTIVE",
    documentType: "RUC",
    documentNumber: "20123456789",
    relationshipType: "SUBCONTRACTED_COMPANY",
    supplierId: "",
    hasSctr: false,
    password: "Clave-Segura-2026",
    ...overrides,
  }) as Parameters<typeof createStaffUser>[0];

async function supplierIdByName(name: string) {
  const [row] = await db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.name, name));
  return row.id;
}

describe("proveedores y cuentas de empresa", () => {
  beforeEach(async () => {
    const admin = await createUser({
      permissions: ["masters:read", "masters:write", "users:read", "users:write"],
    });
    await loginAs(admin.id);
  });

  it("no admite dos proveedores con el mismo RUC", async () => {
    const taxId = `20${String(Date.now()).slice(-9)}`;
    expect((await createSupplier(supplierForm({ taxId }))).success).toBe(true);
    expect((await createSupplier(supplierForm({ taxId }))).success).toBe(false);
  });

  it("la cuenta de empresa exige proveedor y queda como externa a su nombre", async () => {
    const roleId = await fieldRole();
    const form = supplierForm();
    await createSupplier(form);
    const supplierId = await supplierIdByName(form.name);

    const missing = await createStaffUser(staffForm(roleId));
    expect(missing.success).toBe(false);

    const account = staffForm(roleId, { supplierId });
    expect((await createStaffUser(account)).success).toBe(true);

    const [profile] = await db
      .select()
      .from(staffProfiles)
      .innerJoin(users, eq(users.id, staffProfiles.userId))
      .where(eq(users.email, account.email));
    expect(profile.staff_profiles).toMatchObject({
      relationshipType: "SUBCONTRACTED_COMPANY",
      supplierId,
      providerType: "EXTERNAL",
      providerCompany: form.name,
    });
  });

  it("un colaborador trabaja a nombre de HTL: sin proveedor y como interno", async () => {
    const roleId = await fieldRole();
    const form = supplierForm();
    await createSupplier(form);
    const supplierId = await supplierIdByName(form.name);

    const account = staffForm(roleId, {
      relationshipType: "COLLABORATOR",
      supplierId,
      documentType: "DNI",
      documentNumber: "71234567",
    });
    expect((await createStaffUser(account)).success).toBe(true);

    const [profile] = await db
      .select()
      .from(staffProfiles)
      .innerJoin(users, eq(users.id, staffProfiles.userId))
      .where(eq(users.email, account.email));
    expect(profile.staff_profiles).toMatchObject({
      relationshipType: "COLLABORATOR",
      supplierId: null,
      providerType: "INTERNAL",
      providerCompany: null,
    });
  });

  it("renombrar el proveedor actualiza sus cuentas y no se elimina mientras tenga alguna", async () => {
    const roleId = await fieldRole();
    const form = supplierForm();
    await createSupplier(form);
    const supplierId = await supplierIdByName(form.name);
    const account = staffForm(roleId, { supplierId });
    await createStaffUser(account);

    const renamed = `${form.name} Renombrado`;
    expect((await updateSupplier(supplierId, { ...form, name: renamed })).success).toBe(true);
    const [profile] = await db
      .select({ providerCompany: staffProfiles.providerCompany })
      .from(staffProfiles)
      .where(eq(staffProfiles.supplierId, supplierId));
    expect(profile.providerCompany).toBe(renamed);

    expect((await deleteSupplier(supplierId)).success).toBe(false);
  });
});
