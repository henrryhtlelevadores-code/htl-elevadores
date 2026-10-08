"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  brands,
  models,
  serviceTypes,
  ubigeos,
  maintenanceZones,
  maintenanceTasks,
  elevatorTypes,
  type Brand,
  type ElevatorType,
  type Model,
  type ServiceType,
  type Ubigeo,
  type MaintenanceZone,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { getSessionUserId } from "@/features/auth/server";
import { generateUuid } from "@/lib/uuid";
import {
  brandFormSchema,
  elevatorTypeFormSchema,
  modelFormSchema,
  serviceTypeFormSchema,
  ubigeoFormSchema,
  ubigeoBulkImportSchema,
  type BrandFormValues,
  type ElevatorTypeFormValues,
  type ModelFormValues,
  type ServiceTypeFormValues,
  type UbigeoFormValues,
  type UbigeoBulkImportValues,
  maintenanceZoneFormSchema,
  type MaintenanceZoneFormValues,
} from "./schema";
import { and, eq, asc, max } from "drizzle-orm";

// ==========================================
// 1. MARCAS (BRANDS)
// ==========================================

export async function getBrands(): Promise<Brand[]> {
  try {
    return await db.select().from(brands).orderBy(asc(brands.name));
  } catch (error) {
    console.error("Error al obtener marcas desde Turso:", error);
    return [];
  }
}

export async function getMaintenanceZones(): Promise<MaintenanceZone[]> {
  try {
    return await db.select().from(maintenanceZones).orderBy(asc(maintenanceZones.orderIndex));
  } catch (error) {
    console.error("Error al obtener zonas de mantenimiento:", error);
    return [];
  }
}

export async function getMaintenanceElevatorTypes(): Promise<ElevatorType[]> {
  return db.select().from(elevatorTypes).orderBy(asc(elevatorTypes.name));
}

export async function createMaintenanceZone(data: MaintenanceZoneFormValues) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const validated = maintenanceZoneFormSchema.parse(data);
    const [equipmentType] = await db.select({ id: elevatorTypes.id })
      .from(elevatorTypes).where(eq(elevatorTypes.id, validated.elevatorTypeId)).limit(1);
    if (!equipmentType) return { success: false, error: "El tipo de equipo seleccionado no existe." };
    const duplicate = await db.select({ id: maintenanceZones.id }).from(maintenanceZones)
      .where(and(eq(maintenanceZones.name, validated.name.trim()), eq(maintenanceZones.elevatorTypeId, validated.elevatorTypeId))).limit(1);
    if (duplicate.length > 0) return { success: false, error: "Ya existe una zona con ese nombre para este tipo de equipo." };
    const [{ nextOrder }] = await db
      .select({ nextOrder: max(maintenanceZones.orderIndex) })
      .from(maintenanceZones)
      .where(eq(maintenanceZones.elevatorTypeId, validated.elevatorTypeId));
    const orderIndex = (nextOrder ?? 0) + 1;
    const existingCodes = await db.select({ code: maintenanceZones.code }).from(maintenanceZones);
    const usedCodes = new Set(existingCodes.map((zone) => zone.code));
    let codeNumber = 1;
    while (usedCodes.has(`ZONA_${String(codeNumber).padStart(2, "0")}`)) codeNumber += 1;
    const code = `ZONA_${String(codeNumber).padStart(2, "0")}`;
    const id = generateUuid();
    await db.insert(maintenanceZones).values({
      id,
      code,
      name: validated.name.trim(),
      orderIndex,
      isActive: validated.isActive,
      elevatorTypeId: validated.elevatorTypeId,
    });
    revalidatePath("/masters");
    return {
      success: true,
      message: "Zona creada correctamente",
      zone: { id, code, name: validated.name.trim(), orderIndex, isActive: validated.isActive, elevatorTypeId: validated.elevatorTypeId },
    };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateMaintenanceZone(id: string, data: MaintenanceZoneFormValues) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const validated = maintenanceZoneFormSchema.parse(data);
    const [currentZone] = await db.select({ code: maintenanceZones.code, elevatorTypeId: maintenanceZones.elevatorTypeId })
      .from(maintenanceZones).where(eq(maintenanceZones.id, id)).limit(1);
    if (!currentZone) return { success: false, error: "La zona no existe." };

    const [equipmentType] = await db.select({ id: elevatorTypes.id })
      .from(elevatorTypes).where(eq(elevatorTypes.id, validated.elevatorTypeId)).limit(1);
    if (!equipmentType) return { success: false, error: "El tipo de equipo seleccionado no existe." };
    if (validated.elevatorTypeId && currentZone?.elevatorTypeId !== validated.elevatorTypeId) {
      const assignedTasks = await db.select({ id: maintenanceTasks.id }).from(maintenanceTasks)
        .where(eq(maintenanceTasks.zoneId, id)).limit(1);
      if (assignedTasks.length > 0) return { success: false, error: "No se puede cambiar el tipo: la zona tiene tareas asignadas." };
    }
    const duplicate = await db.select({ id: maintenanceZones.id }).from(maintenanceZones)
      .where(and(eq(maintenanceZones.name, validated.name.trim()), eq(maintenanceZones.elevatorTypeId, validated.elevatorTypeId))).limit(1);
    if (duplicate.length > 0 && duplicate[0].id !== id) return { success: false, error: "Ya existe una zona con ese nombre para este tipo de equipo." };
    await db.update(maintenanceZones).set({
      ...(validated.code ? { code: validated.code.trim().toUpperCase() } : {}),
      name: validated.name.trim(),
      orderIndex: validated.orderIndex,
      isActive: validated.isActive,
      elevatorTypeId: validated.elevatorTypeId,
    }).where(eq(maintenanceZones.id, id));
    revalidatePath("/masters");
    revalidatePath("/configuracion/mantenimiento/modulos");
    return {
      success: true,
      message: "Zona actualizada correctamente",
      zone: { id, code: validated.code?.trim().toUpperCase() || currentZone.code, name: validated.name.trim(), orderIndex: validated.orderIndex ?? 0, isActive: validated.isActive, elevatorTypeId: validated.elevatorTypeId },
    };
  } catch (error) {
    console.error("Error al actualizar zona de mantenimiento:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteMaintenanceZone(id: string) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    await db.delete(maintenanceZones).where(eq(maintenanceZones.id, id));
    revalidatePath("/masters");
    return { success: true, message: "Zona eliminada correctamente" };
  } catch (error) {
    return { success: false, error: "No se puede eliminar una zona utilizada por tareas." };
  }
}

export async function createBrand(data: BrandFormValues) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const validated = brandFormSchema.parse(data);

    await db.insert(brands).values({
      id: generateUuid(),
      name: validated.name.trim(),
      country: validated.country?.trim() || null,
    });

    revalidatePath("/masters");
    return { success: true, message: "Marca creada correctamente" };
  } catch (error) {
    console.error("Error al crear marca:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El nombre de la marca ya existe." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateBrand(id: string, data: Partial<BrandFormValues>) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const updateData: { name?: string; country?: string | null; isActive?: boolean } = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.country !== undefined) updateData.country = data.country?.trim() || null;

    await db.update(brands).set(updateData).where(eq(brands.id, id));

    revalidatePath("/masters");
    return { success: true, message: "Marca actualizada con éxito" };
  } catch (error) {
    console.error("Error al actualizar marca:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteBrand(id: string) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    await db.delete(brands).where(eq(brands.id, id));
    revalidatePath("/masters");
    return { success: true, message: "Marca eliminada correctamente" };
  } catch (error) {
    console.error("Error al eliminar marca:", error);
    if (getErrorMessage(error).includes("FOREIGN KEY constraint failed")) {
      return {
        success: false,
        error: "No se puede eliminar la marca porque tiene modelos asociados.",
      };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 2. TIPOS DE ASCENSOR (ELEVATOR TYPES)
// ==========================================

export async function getElevatorTypes(): Promise<ElevatorType[]> {
  try {
    return await db.select().from(elevatorTypes).orderBy(asc(elevatorTypes.name));
  } catch (error) {
    console.error("Error al obtener tipos de ascensor:", error);
    return [];
  }
}

export async function createElevatorType(data: ElevatorTypeFormValues) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const validated = elevatorTypeFormSchema.parse(data);

    await db.insert(elevatorTypes).values({
      id: generateUuid(),
      name: validated.name.trim(),
    });

    revalidatePath("/masters");
    return { success: true, message: "Tipo de ascensor creado correctamente" };
  } catch (error) {
    console.error("Error al crear tipo de ascensor:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El tipo de ascensor ya existe." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateElevatorType(
  id: string,
  data: Partial<ElevatorTypeFormValues>
) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const updateData: { name?: string; isActive?: boolean } = {};
    if (data.name) updateData.name = data.name.trim();

    await db.update(elevatorTypes).set(updateData).where(eq(elevatorTypes.id, id));

    revalidatePath("/masters");
    return { success: true, message: "Tipo de ascensor actualizado" };
  } catch (error) {
    console.error("Error al actualizar tipo de ascensor:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteElevatorType(id: string) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    await db.delete(elevatorTypes).where(eq(elevatorTypes.id, id));
    revalidatePath("/masters");
    return { success: true, message: "Tipo de ascensor eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar tipo de ascensor:", error);
    if (getErrorMessage(error).includes("FOREIGN KEY constraint failed")) {
      return {
        success: false,
        error: "No se puede eliminar el tipo porque tiene equipos asignados.",
      };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 3. MODELOS (MODELS)
// ==========================================

export type ModelWithBrand = Model & { brand_name?: string | null };

export async function getModels(): Promise<ModelWithBrand[]> {
  try {
    const result = await db
      .select({
        id: models.id,
        brandId: models.brandId,
        name: models.name,
        techSpecs: models.techSpecs,
        isActive: models.isActive,
        brand_name: brands.name,
      })
      .from(models)
      .leftJoin(brands, eq(models.brandId, brands.id))
      .orderBy(asc(models.name));

    return result;
  } catch (error) {
    console.error("Error al obtener modelos con marcas:", error);
    return [];
  }
}

export async function createModel(data: ModelFormValues) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const validated = modelFormSchema.parse(data);

    await db.insert(models).values({
      id: generateUuid(),
      brandId: validated.brandId,
      name: validated.name.trim(),
      techSpecs: validated.techSpecs?.trim() || null,
    });

    revalidatePath("/masters");
    return { success: true, message: "Modelo creado con éxito" };
  } catch (error) {
    console.error("Error al crear modelo:", error);
    if (getErrorMessage(error).includes("FOREIGN KEY constraint failed")) {
      return { success: false, error: "La marca seleccionada no existe." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateModel(id: string, data: Partial<ModelFormValues>) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const updateData: { name?: string; brandId?: string; techSpecs?: string | null; isActive?: boolean } = {};
    if (data.name) updateData.name = data.name.trim();
    if (data.brandId) updateData.brandId = data.brandId;
    if (data.techSpecs !== undefined) updateData.techSpecs = data.techSpecs?.trim() || null;

    await db.update(models).set(updateData).where(eq(models.id, id));

    revalidatePath("/masters");
    return { success: true, message: "Modelo actualizado con éxito" };
  } catch (error) {
    console.error("Error al actualizar modelo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteModel(id: string) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    await db.delete(models).where(eq(models.id, id));
    revalidatePath("/masters");
    return { success: true, message: "Modelo eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar modelo:", error);
    if (getErrorMessage(error).includes("FOREIGN KEY constraint failed")) {
      return {
        success: false,
        error: "No se puede eliminar el modelo porque tiene equipos vinculados.",
      };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 4. TIPOS DE SERVICIO (SERVICE TYPES)
// ==========================================

export async function getServiceTypes(): Promise<ServiceType[]> {
  try {
    return await db.select().from(serviceTypes).orderBy(asc(serviceTypes.name));
  } catch (error) {
    console.error("Error al obtener tipos de servicio:", error);
    return [];
  }
}

export async function createServiceType(data: ServiceTypeFormValues) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const validated = serviceTypeFormSchema.parse(data);

    await db.insert(serviceTypes).values({
      id: generateUuid(),
      code: validated.code.trim().toUpperCase(),
      name: validated.name.trim(),
      category: validated.category,
      requiresContract: validated.requiresContract,
      defaultSlaMins: validated.defaultSlaMins ? Number(validated.defaultSlaMins) : null,
      isBillableByDefault: validated.isBillableByDefault,
    });

    revalidatePath("/masters");
    return { success: true, message: "Tipo de servicio creado correctamente" };
  } catch (error) {
    console.error("Error al crear tipo de servicio:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El código del tipo de servicio ya existe." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateServiceType(id: string, data: Partial<ServiceTypeFormValues>) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const updateData: {
      code?: string;
      name?: string;
      category?: string;
      requiresContract?: boolean;
      defaultSlaMins?: number | null;
      isBillableByDefault?: boolean;
      isActive?: boolean;
    } = {};
    if (data.code) updateData.code = data.code.trim().toUpperCase();
    if (data.name) updateData.name = data.name.trim();
    if (data.category) updateData.category = data.category;
    if (data.requiresContract !== undefined) updateData.requiresContract = data.requiresContract;
    if (data.defaultSlaMins !== undefined)
      updateData.defaultSlaMins = data.defaultSlaMins ? Number(data.defaultSlaMins) : null;
    if (data.isBillableByDefault !== undefined)
      updateData.isBillableByDefault = data.isBillableByDefault;

    await db.update(serviceTypes).set(updateData).where(eq(serviceTypes.id, id));

    revalidatePath("/masters");
    return { success: true, message: "Tipo de servicio actualizado" };
  } catch (error) {
    console.error("Error al actualizar tipo de servicio:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteServiceType(id: string) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    await db.delete(serviceTypes).where(eq(serviceTypes.id, id));
    revalidatePath("/masters");
    return { success: true, message: "Tipo de servicio eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar tipo de servicio:", error);
    if (getErrorMessage(error).includes("FOREIGN KEY constraint failed")) {
      return {
        success: false,
        error: "No se puede eliminar el tipo de servicio porque tiene contratos asociados.",
      };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 5. UBIGEOS
// ==========================================

export async function getUbigeos(): Promise<Ubigeo[]> {
  try {
    return await db
      .select()
      .from(ubigeos)
      .orderBy(asc(ubigeos.departamento), asc(ubigeos.provincia), asc(ubigeos.distrito));
  } catch (error) {
    console.error("Error al obtener ubigeos desde Turso:", error);
    return [];
  }
}

export async function createUbigeo(data: UbigeoFormValues) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const validated = ubigeoFormSchema.parse(data);

    await db.insert(ubigeos).values({
      id: validated.id.trim().toUpperCase(),
      departamento: validated.departamento.trim(),
      provincia: validated.provincia.trim(),
      distrito: validated.distrito.trim(),
      latitud: validated.latitud ? Number(validated.latitud) : null,
      longitud: validated.longitud ? Number(validated.longitud) : null,
    });

    revalidatePath("/masters");
    return { success: true, message: "Ubigeo creado correctamente" };
  } catch (error) {
    console.error("Error al crear ubigeo:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El código de ubigeo ya existe." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateUbigeo(id: string, data: Partial<UbigeoFormValues>) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const updateData: {
      departamento?: string;
      provincia?: string;
      distrito?: string;
      latitud?: number | null;
      longitud?: number | null;
    } = {};
    if (data.departamento !== undefined) updateData.departamento = data.departamento.trim();
    if (data.provincia !== undefined) updateData.provincia = data.provincia.trim();
    if (data.distrito !== undefined) updateData.distrito = data.distrito.trim();
    if (data.latitud !== undefined)
      updateData.latitud = data.latitud ? Number(data.latitud) : null;
    if (data.longitud !== undefined)
      updateData.longitud = data.longitud ? Number(data.longitud) : null;

    await db.update(ubigeos).set(updateData).where(eq(ubigeos.id, id));

    revalidatePath("/masters");
    return { success: true, message: "Ubigeo actualizado" };
  } catch (error) {
    console.error("Error al actualizar ubigeo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteUbigeo(id: string) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    await db.delete(ubigeos).where(eq(ubigeos.id, id));
    revalidatePath("/masters");
    return { success: true, message: "Ubigeo eliminado correctamente" };
  } catch (error) {
    console.error("Error al eliminar ubigeo:", error);
    if (getErrorMessage(error).includes("FOREIGN KEY constraint failed")) {
      return {
        success: false,
        error: "No se puede eliminar el ubigeo porque tiene sedes asignadas.",
      };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function importUbigeosBulk(data: UbigeoBulkImportValues) {
  if (!(await getSessionUserId())) return { success: false, error: "Sesión requerida" };
  try {
    const validated = ubigeoBulkImportSchema.parse(data);

    await db.insert(ubigeos).values(
      validated.map((item) => ({
        id: item.Ubigeo.trim().toUpperCase(),
        departamento: item.Departamento.trim(),
        provincia: item.Provincia.trim(),
        distrito: item.Distrito.trim(),
        latitud: item.Latitud != null ? Number(item.Latitud) : null,
        longitud: item.Longitud != null ? Number(item.Longitud) : null,
      }))
    );

    revalidatePath("/masters");
    return {
      success: true,
      message: `${validated.length} ubigeos importados correctamente`,
    };
  } catch (error) {
    console.error("Error al importar ubigeos:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return {
        success: false,
        error:
          "Uno o más códigos de ubigeo ya existen. Revisa los datos e intenta nuevamente.",
      };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}
