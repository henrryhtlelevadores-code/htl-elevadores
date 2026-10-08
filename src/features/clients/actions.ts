"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  clients,
  costCenters,
  costCenterContacts,
  workOrders,
  workOrderElevators,
  elevatorUnities,
  serviceTypes,
  users,
  type Client,
  type CostCenter,
  type CostCenterContact,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import {
  clientFormSchema,
  costCenterFormSchema,
  contactFormSchema,
  type ClientFormValues,
  type CostCenterFormValues,
  type ContactFormValues,
} from "./schema";
import { eq, asc, count, and, isNull, desc, sql } from "drizzle-orm";
import { hashPassword } from "@/features/users/password";
import { validateNewPassword } from "@/lib/password-policy";
import { denyUnless, requirePermission } from "@/features/auth/guard";

export type ClientWithStats = Client & {
  cost_centers_count?: number;
};

export type CostCenterCalendarEquipment = {
  internalCode: string;
  name: string;
};

export async function getCostCenterCalendarWorkOrders(
  costCenterId: string,
  from: string,
  to: string,
  serviceType = "ALL",
  status = "ACTIVE"
) {
  await requirePermission("clients:read");
  const rows = await db
    .select({
      id: workOrders.id,
      otNumber: workOrders.otNumber,
      scheduledDate: workOrders.scheduledDate,
      scheduledTime: workOrders.scheduledTime,
      status: workOrders.status,
      serviceTypeCode: serviceTypes.code,
      serviceTypeName: serviceTypes.name,
      serviceTypeCategory: serviceTypes.category,
      technicianName: users.fullName,
      elevatorInternalCode: elevatorUnities.internalCode,
      elevatorName: elevatorUnities.name,
    })
    .from(workOrders)
    .innerJoin(workOrderElevators, eq(workOrderElevators.workOrderId, workOrders.id))
    .innerJoin(elevatorUnities, eq(elevatorUnities.id, workOrderElevators.elevatorUnityId))
    .leftJoin(serviceTypes, eq(serviceTypes.id, workOrders.serviceTypeId))
    .leftJoin(users, eq(users.id, workOrders.technicianId))
    .where(and(
      eq(elevatorUnities.costCenterId, costCenterId),
      isNull(workOrders.deletedAt)
    ))
    .orderBy(asc(workOrders.scheduledDate), asc(workOrders.scheduledTime), desc(workOrders.createdAt));
  const filtered = rows.filter((row) => {
    if (!row.scheduledDate || row.scheduledDate < from || row.scheduledDate > to) return false;
    if (serviceType !== "ALL" && (serviceType.startsWith("CORR") ? !row.serviceTypeCode?.startsWith("CORR") : serviceType.startsWith("EMER") ? !row.serviceTypeCode?.startsWith("EMER") : row.serviceTypeCode !== serviceType)) return false;
    if (status === "ACTIVE" && (row.status === "COMPLETED" || row.status === "CANCELLED")) return false;
    if (status !== "ALL" && status !== "ACTIVE" && row.status !== status) return false;
    return true;
  });
  // Una fila por par OT/equipo: se colapsan en un registro por OT acumulando
  // todos los equipos, en vez de conservar solo el último.
  const byWorkOrder = new Map<string, (typeof filtered)[number] & { equipments: CostCenterCalendarEquipment[] }>();
  for (const row of filtered) {
    const existing = byWorkOrder.get(row.id);
    const equipment: CostCenterCalendarEquipment = { internalCode: row.elevatorInternalCode, name: row.elevatorName };
    if (!existing) {
      byWorkOrder.set(row.id, { ...row, equipments: [equipment] });
      continue;
    }
    if (!existing.equipments.some((item) => item.internalCode === equipment.internalCode)) {
      existing.equipments.push(equipment);
    }
  }
  return [...byWorkOrder.values()];
}

export type CostCenterCredentialStatus = {
  id: string;
  hasPassword: boolean;
  costCenterId: string;
}

// ==========================================
// 1. CLIENTES (CLIENTS)
// ==========================================

export async function getClients(): Promise<ClientWithStats[]> {
  await requirePermission("clients:read", "contracts:read", "maintenance:read");
  try {
    const result = await db
      .select({
        id: clients.id,
        legalName: clients.legalName,
        taxId: clients.taxId,
        taxIdType: clients.taxIdType,
        billingAddress: clients.billingAddress,
        billingEmail: clients.billingEmail,
        logoUrl: clients.logoUrl,
        status: clients.status,
        createdAt: clients.createdAt,
        deletedAt: clients.deletedAt,
        cost_centers_count: count(costCenters.id),
      })
      .from(clients)
      .leftJoin(costCenters, eq(clients.id, costCenters.clientId))
      .where(isNull(clients.deletedAt))
      .groupBy(clients.id)
      .orderBy(asc(clients.legalName));

    return result;
  } catch (error) {
    console.error("Error al obtener clientes desde Turso:", error);
    return [];
  }
}

export async function createClient(data: ClientFormValues) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    const validated = clientFormSchema.parse(data);

    const clientId = generateUuid();
    await db.insert(clients).values({
      id: clientId,
      legalName: validated.legalName.trim(),
      taxId: validated.taxId?.trim() || null,
      taxIdType: validated.taxIdType || "RUC",
      billingAddress: validated.billingAddress?.trim() || null,
      billingEmail: validated.billingEmail?.trim() || null,
    });

    let createdHeadquarters = false;
    if (validated.createDefaultHeadquarters && validated.headquartersAddress?.trim()) {
      await db.insert(costCenters).values({
        id: generateUuid(),
        clientId,
        name: "Sede Principal",
        address: validated.headquartersAddress.trim(),
        ubigeoId: validated.headquartersUbigeoId?.trim() || null,
      });
      createdHeadquarters = true;
    }

    revalidatePath("/clients");
    return { success: true, message: "Cliente registrado correctamente", createdHeadquarters };
  } catch (error) {
    console.error("Error al crear cliente:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El RUC ya existe en el sistema." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateClient(id: string, data: Partial<ClientFormValues>) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    const updateData: {
      legalName?: string;
      taxId?: string | null;
      taxIdType?: string;
      billingAddress?: string | null;
      billingEmail?: string | null;
      status?: string;
    } = {};
    if (data.legalName) updateData.legalName = data.legalName.trim();
    if (data.taxId !== undefined) updateData.taxId = data.taxId?.trim() || null;
    if (data.taxIdType) updateData.taxIdType = data.taxIdType;
    if (data.billingAddress !== undefined)
      updateData.billingAddress = data.billingAddress?.trim() || null;
    if (data.billingEmail !== undefined)
      updateData.billingEmail = data.billingEmail?.trim() || null;

    await db.update(clients).set(updateData).where(eq(clients.id, id));

    revalidatePath("/clients");
    return { success: true, message: "Cliente actualizado exitosamente" };
  } catch (error) {
    console.error("Error al actualizar cliente:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteClient(id: string) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    await db.update(clients).set({ deletedAt: Math.floor(Date.now() / 1000) }).where(eq(clients.id, id));
    revalidatePath("/clients");
    return { success: true, message: "Cliente eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 2. CENTROS DE COSTO (COST CENTERS)
// ==========================================

export async function getCostCenters(id_client?: string): Promise<CostCenter[]> {
  await requirePermission("clients:read");
  try {
    if (id_client) {
      return await db
        .select()
        .from(costCenters)
        .where(and(eq(costCenters.clientId, id_client), isNull(costCenters.deletedAt)))
        .orderBy(asc(costCenters.name));
    }
    return await db
      .select()
      .from(costCenters)
      .where(isNull(costCenters.deletedAt))
      .orderBy(asc(costCenters.name));
  } catch (error) {
    console.error("Error al obtener centros de costo:", error);
    return [];
  }
}

export async function createCostCenter(data: CostCenterFormValues) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    const validated = costCenterFormSchema.parse(data);

    await db.insert(costCenters).values({
      id: generateUuid(),
      clientId: validated.clientId,
      name: validated.name.trim(),
      address: validated.address.trim(),
      ubigeoId: validated.ubigeoId?.trim() || null,
    });

    revalidatePath("/clients");
    return { success: true, message: "Centro de costo registrado correctamente" };
  } catch (error) {
    console.error("Error al crear centro de costo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateCostCenter(id: string, data: Partial<CostCenterFormValues>) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    const updateData: { name?: string; address?: string; ubigeoId?: string | null } = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.address) updateData.address = data.address.trim();
    if (data.ubigeoId !== undefined) updateData.ubigeoId = data.ubigeoId?.trim() || null;

    await db.update(costCenters).set(updateData).where(eq(costCenters.id, id));

    revalidatePath("/clients");
    return { success: true, message: "Centro de costo actualizado" };
  } catch (error) {
    console.error("Error al actualizar centro de costo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteCostCenter(id: string) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    await db.update(costCenters).set({ deletedAt: Math.floor(Date.now() / 1000) }).where(eq(costCenters.id, id));
    revalidatePath("/clients");
    return { success: true, message: "Centro de costo eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar centro de costo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 3. CONTACTOS (COST CENTER CONTACTS)
// ==========================================

export async function getCostCenterContacts(
  id_ccenter?: string
): Promise<CostCenterContact[]> {
  await requirePermission("clients:read");
  try {
    if (id_ccenter) {
      return await db
        .select()
        .from(costCenterContacts)
        .where(eq(costCenterContacts.costCenterId, id_ccenter))
        .orderBy(asc(costCenterContacts.fullName));
    }
    return await db
      .select()
      .from(costCenterContacts)
      .orderBy(asc(costCenterContacts.fullName));
  } catch (error) {
    console.error("Error al obtener contactos:", error);
    return [];
  }
}

export async function createContact(data: ContactFormValues) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    const validated = contactFormSchema.parse(data);

    await db.insert(costCenterContacts).values({
      id: generateUuid(),
      costCenterId: validated.costCenterId,
      fullName: validated.fullName.trim(),
      role: validated.role?.trim() || "Administrador",
      phone: validated.phone?.trim() || null,
      email: validated.email?.trim() || null,
    });

    revalidatePath("/clients");
    return { success: true, message: "Contacto registrado correctamente" };
  } catch (error) {
    console.error("Error al crear contacto:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateContact(id: string, data: Partial<ContactFormValues>) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    const updateData: {
      fullName?: string;
      role?: string;
      phone?: string | null;
      email?: string | null;
      isActive?: boolean;
    } = {};
    if (data.fullName) updateData.fullName = data.fullName.trim();
    if (data.role) updateData.role = data.role.trim();
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
    if (data.email !== undefined) updateData.email = data.email?.trim() || null;

    await db.update(costCenterContacts).set(updateData).where(eq(costCenterContacts.id, id));

    revalidatePath("/clients");
    return { success: true, message: "Contacto actualizado" };
  } catch (error) {
    console.error("Error al actualizar contacto:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteContact(id: string) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    await db.delete(costCenterContacts).where(eq(costCenterContacts.id, id));
    revalidatePath("/clients");
    return { success: true, message: "Contacto eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar contacto:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 4. CREDENCIALES DEL PORTAL (PASSWORD HASH)
// ==========================================

export async function setCostCenterPassword(
  costCenterId: string,
  plainTextPin: string,
  options: { passwordGenerated?: boolean } = {}
) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    const passwordError = validateNewPassword(plainTextPin, "portal", {
      generated: options.passwordGenerated,
    });
    if (passwordError) return { success: false, error: passwordError };

    const hash = await hashPassword(plainTextPin);

    await db
      .update(costCenters)
      .set({ passwordHash: hash, portalSessionVersion: sql`${costCenters.portalSessionVersion} + 1` })
      .where(eq(costCenters.id, costCenterId));

    revalidatePath("/clients");
    return { success: true, message: "Credencial del portal establecida correctamente" };
  } catch (error) {
    console.error("Error al generar la credencial del edificio:", error);
    return { success: false, error: "Error al generar la credencial del edificio" };
  }
}

export async function clearCostCenterPassword(costCenterId: string) {
  const denied = await denyUnless("clients:write");
  if (denied) return denied;
  try {
    await db
      .update(costCenters)
      .set({ passwordHash: null, portalSessionVersion: sql`${costCenters.portalSessionVersion} + 1` })
      .where(eq(costCenters.id, costCenterId));

    revalidatePath("/clients");
    return { success: true, message: "Credencial del portal eliminada" };
  } catch (error) {
    console.error("Error al eliminar la credencial del edificio:", error);
    return { success: false, error: "Error al eliminar la credencial del edificio" };
  }
}
