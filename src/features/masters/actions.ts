"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  brands,
  elevatorTypes,
  models,
  serviceTypes,
  type Brand,
  type ElevatorType,
  type Model,
  type ServiceType,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import {
  brandFormSchema,
  elevatorTypeFormSchema,
  modelFormSchema,
  serviceTypeFormSchema,
  type BrandFormValues,
  type ElevatorTypeFormValues,
  type ModelFormValues,
  type ServiceTypeFormValues,
} from "./schema";
import { eq, asc } from "drizzle-orm";

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

export async function createBrand(data: BrandFormValues) {
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