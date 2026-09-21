"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  clients,
  costCenters,
  costCenterContacts,
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
import { eq, asc, count, and, isNull } from "drizzle-orm";
import { hashPassword } from "@/features/users/password";
import { verify } from "@node-rs/argon2";

export type ClientWithStats = Client & {
  cost_centers_count?: number;
};

export type CostCenterCredentialStatus = {
  id: string;
  hasPassword: boolean;
  costCenterId: string;
}

// ==========================================
// 1. CLIENTES (CLIENTS)
// ==========================================

export async function getClients(): Promise<ClientWithStats[]> {
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
  try {
    const validated = clientFormSchema.parse(data);

    await db.insert(clients).values({
      id: generateUuid(),
      legalName: validated.legalName.trim(),
      taxId: validated.taxId.trim(),
      taxIdType: validated.taxIdType || "RUC",
      billingAddress: validated.billingAddress?.trim() || null,
      billingEmail: validated.billingEmail?.trim() || null,
    });

    revalidatePath("/clients");
    return { success: true, message: "Cliente registrado correctamente" };
  } catch (error) {
    console.error("Error al crear cliente:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El RUC ya existe en el sistema." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateClient(id: string, data: Partial<ClientFormValues>) {
  try {
    const updateData: {
      legalName?: string;
      taxId?: string;
      billingAddress?: string | null;
      billingEmail?: string | null;
      status?: string;
    } = {};
    if (data.legalName) updateData.legalName = data.legalName.trim();
    if (data.taxId) updateData.taxId = data.taxId.trim();
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
  try {
    const validated = costCenterFormSchema.parse(data);

    await db.insert(costCenters).values({
      id: generateUuid(),
      clientId: validated.clientId,
      name: validated.name.trim(),
      address: validated.address.trim(),
      district: validated.district?.trim() || null,
    });

    revalidatePath("/clients");
    return { success: true, message: "Centro de costo registrado correctamente" };
  } catch (error) {
    console.error("Error al crear centro de costo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateCostCenter(id: string, data: Partial<CostCenterFormValues>) {
  try {
    const updateData: { name?: string; address?: string; district?: string | null } = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.address) updateData.address = data.address.trim();
    if (data.district !== undefined) updateData.district = data.district?.trim() || null;

    await db.update(costCenters).set(updateData).where(eq(costCenters.id, id));

    revalidatePath("/clients");
    return { success: true, message: "Centro de costo actualizado" };
  } catch (error) {
    console.error("Error al actualizar centro de costo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteCostCenter(id: string) {
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

export async function setCostCenterPassword(costCenterId: string, plainTextPin: string) {
  try {
    if (!plainTextPin || plainTextPin.trim().length < 6) {
      return { success: false, error: "La contraseña debe tener al menos 6 caracteres." };
    }

    const hash = await hashPassword(plainTextPin);

    await db
      .update(costCenters)
      .set({ passwordHash: hash })
      .where(eq(costCenters.id, costCenterId));

    revalidatePath("/clients");
    return { success: true, message: "Credencial del portal establecida correctamente" };
  } catch (error) {
    console.error("Error al generar la credencial del edificio:", error);
    return { success: false, error: "Error al generar la credencial del edificio" };
  }
}

export async function clearCostCenterPassword(costCenterId: string) {
  try {
    await db
      .update(costCenters)
      .set({ passwordHash: null })
      .where(eq(costCenters.id, costCenterId));

    revalidatePath("/clients");
    return { success: true, message: "Credencial del portal eliminada" };
  } catch (error) {
    console.error("Error al eliminar la credencial del edificio:", error);
    return { success: false, error: "Error al eliminar la credencial del edificio" };
  }
}

export type VerifyCostCenterCredentialResult =
  | { success: true; costCenter: { id: string; name: string; address: string | null } }
  | { success: false; error: string };

export async function verifyCostCenterCredentials(
  costCenterId: string,
  plainTextPin: string
): Promise<VerifyCostCenterCredentialResult> {
  try {
    const rows = await db
      .select({ id: costCenters.id, name: costCenters.name, address: costCenters.address, passwordHash: costCenters.passwordHash })
      .from(costCenters)
      .where(eq(costCenters.id, costCenterId))
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

    return { success: true, costCenter: { id: row.id, name: row.name, address: row.address } };
  } catch (error) {
    console.error("Error al verificar credenciales del edificio:", error);
    return { success: false, error: "Error al verificar las credenciales." };
  }
}