"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  elevatorUnities,
  costCenters,
  clients,
  brands,
  models,
  elevatorTypes,
  type ElevatorUnity,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import { elevatorUnityFormSchema, type ElevatorUnityFormValues } from "./schema";
import { eq, asc, isNull } from "drizzle-orm";

export type ElevatorUnityWithRelations = ElevatorUnity & {
  cost_center_name?: string | null;
  client_name?: string | null;
  brand_name?: string | null;
  model_name?: string | null;
  elevator_type_name?: string | null;
};

export async function getEquipmentList(): Promise<ElevatorUnityWithRelations[]> {
  try {
    return await db
      .select({
        id: elevatorUnities.id,
        costCenterId: elevatorUnities.costCenterId,
        brandId: elevatorUnities.brandId,
        modelId: elevatorUnities.modelId,
        elevatorTypeId: elevatorUnities.elevatorTypeId,
        internalCode: elevatorUnities.internalCode,
        manufacturerSerial: elevatorUnities.manufacturerSerial,
        name: elevatorUnities.name,
        capacityPersons: elevatorUnities.capacityPersons,
        capacityKg: elevatorUnities.capacityKg,
        speedMs: elevatorUnities.speedMs,
        stops: elevatorUnities.stops,
        floors: elevatorUnities.floors,
        tractionType: elevatorUnities.tractionType,
        yearOfFabrication: elevatorUnities.yearOfFabrication,
        status: elevatorUnities.status,
        installationDate: elevatorUnities.installationDate,
        referencePhotos: elevatorUnities.referencePhotos,
        createdAt: elevatorUnities.createdAt,
        deletedAt: elevatorUnities.deletedAt,
        cost_center_name: costCenters.name,
        client_name: clients.legalName,
        brand_name: brands.name,
        model_name: models.name,
        elevator_type_name: elevatorTypes.name,
      })
      .from(elevatorUnities)
      .innerJoin(costCenters, eq(elevatorUnities.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .leftJoin(brands, eq(elevatorUnities.brandId, brands.id))
      .leftJoin(models, eq(elevatorUnities.modelId, models.id))
      .innerJoin(elevatorTypes, eq(elevatorUnities.elevatorTypeId, elevatorTypes.id))
      .where(isNull(elevatorUnities.deletedAt))
      .orderBy(asc(elevatorUnities.internalCode));
  } catch (error) {
    console.error("Error al obtener equipos:", error);
    return [];
  }
}

export interface EquipmentFormData {
  clients: Array<{ id: string; legalName: string }>;
  costCenters: Array<{ id: string; name: string; clientId: string; client_name: string }>;
  brands: Array<{ id: string; name: string }>;
  models: Array<{ id: string; name: string; brandId: string }>;
  elevatorTypes: Array<{ id: string; name: string }>;
}

export async function getEquipmentFormData(): Promise<EquipmentFormData> {
  const [clientRes, ccRes, brandRes, modelRes, typeRes] = await Promise.all([
    db
      .select({ id: clients.id, legalName: clients.legalName })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.legalName)),
    db
      .select({
        id: costCenters.id,
        name: costCenters.name,
        clientId: costCenters.clientId,
        client_name: clients.legalName,
      })
      .from(costCenters)
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .where(isNull(costCenters.deletedAt))
      .orderBy(asc(costCenters.name)),
    db.select({ id: brands.id, name: brands.name }).from(brands).orderBy(asc(brands.name)),
    db
      .select({ id: models.id, name: models.name, brandId: models.brandId })
      .from(models)
      .orderBy(asc(models.name)),
    db
      .select({ id: elevatorTypes.id, name: elevatorTypes.name })
      .from(elevatorTypes)
      .orderBy(asc(elevatorTypes.name)),
  ]);

  return {
    clients: clientRes,
    costCenters: ccRes,
    brands: brandRes,
    models: modelRes,
    elevatorTypes: typeRes,
  };
}

export async function createEquipment(data: ElevatorUnityFormValues) {
  try {
    const validated = elevatorUnityFormSchema.parse(data);

    await db.insert(elevatorUnities).values({
      id: generateUuid(),
      costCenterId: validated.costCenterId,
      brandId: validated.brandId || null,
      modelId: validated.modelId || null,
      elevatorTypeId: validated.elevatorTypeId,
      internalCode: validated.internalCode.trim().toUpperCase(),
      manufacturerSerial: validated.manufacturerSerial?.trim() || null,
      name: validated.name.trim(),
      capacityPersons: validated.capacityPersons ?? null,
      capacityKg: validated.capacityKg ?? null,
      speedMs: validated.speedMs ?? null,
      stops: validated.stops ?? null,
      floors: validated.floors ?? null,
      tractionType: validated.tractionType?.trim() || null,
      yearOfFabrication: validated.yearOfFabrication ?? null,
      status: validated.status || "OPERATIVE",
    });

    revalidatePath("/equipment");
    return { success: true, message: "Equipo registrado correctamente" };
  } catch (error) {
    console.error("Error al crear equipo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateEquipment(id: string, data: Partial<ElevatorUnityFormValues>) {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.costCenterId) updateData.costCenterId = data.costCenterId;
    if (data.brandId !== undefined) updateData.brandId = data.brandId || null;
    if (data.modelId !== undefined) updateData.modelId = data.modelId || null;
    if (data.elevatorTypeId) updateData.elevatorTypeId = data.elevatorTypeId;
    if (data.internalCode) updateData.internalCode = data.internalCode.trim().toUpperCase();
    if (data.manufacturerSerial !== undefined)
      updateData.manufacturerSerial = data.manufacturerSerial?.trim() || null;
    if (data.name) updateData.name = data.name.trim();
    if (data.capacityPersons !== undefined) updateData.capacityPersons = data.capacityPersons ?? null;
    if (data.capacityKg !== undefined) updateData.capacityKg = data.capacityKg ?? null;
    if (data.speedMs !== undefined) updateData.speedMs = data.speedMs ?? null;
    if (data.stops !== undefined) updateData.stops = data.stops ?? null;
    if (data.floors !== undefined) updateData.floors = data.floors ?? null;
    if (data.tractionType !== undefined) updateData.tractionType = data.tractionType?.trim() || null;
    if (data.yearOfFabrication !== undefined) updateData.yearOfFabrication = data.yearOfFabrication ?? null;
    if (data.status) updateData.status = data.status;

    await db.update(elevatorUnities).set(updateData).where(eq(elevatorUnities.id, id));

    revalidatePath("/equipment");
    return { success: true, message: "Equipo actualizado exitosamente" };
  } catch (error) {
    console.error("Error al actualizar equipo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function toggleEquipmentStatus(id: string, status: string) {
  try {
    await db.update(elevatorUnities).set({ status }).where(eq(elevatorUnities.id, id));
    revalidatePath("/equipment");
    return { success: true, message: "Estado del equipo actualizado" };
  } catch (error) {
    console.error("Error al cambiar estado del equipo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteEquipment(id: string) {
  try {
    await db
      .update(elevatorUnities)
      .set({ deletedAt: Math.floor(Date.now() / 1000) })
      .where(eq(elevatorUnities.id, id));
    revalidatePath("/equipment");
    return { success: true, message: "Equipo eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar equipo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}