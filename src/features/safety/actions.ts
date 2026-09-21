"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  safetyTemplates,
  elevatorTypes,
  type SafetyTemplate,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import {
  safetyTemplateFormSchema,
  type SafetyTemplateFormValues,
} from "./schema";
import { eq, asc } from "drizzle-orm";

export type SafetyTemplateWithType = SafetyTemplate & {
  elevator_type_name?: string | null;
};

export async function getSafetyTemplates(): Promise<SafetyTemplateWithType[]> {
  try {
    return await db
      .select({
        id: safetyTemplates.id,
        type: safetyTemplates.type,
        equipmentTypeId: safetyTemplates.equipmentTypeId,
        name: safetyTemplates.name,
        version: safetyTemplates.version,
        content: safetyTemplates.content,
        isActive: safetyTemplates.isActive,
        createdAt: safetyTemplates.createdAt,
        elevator_type_name: elevatorTypes.name,
      })
      .from(safetyTemplates)
      .leftJoin(elevatorTypes, eq(safetyTemplates.equipmentTypeId, elevatorTypes.id))
      .orderBy(asc(safetyTemplates.type));
  } catch (error) {
    console.error("Error al obtener plantillas de seguridad:", error);
    return [];
  }
}

export async function createSafetyTemplate(data: SafetyTemplateFormValues) {
  try {
    const validated = safetyTemplateFormSchema.parse(data);

    const parsedContent = validated.content;
    try {
      JSON.parse(validated.content);
    } catch {
      return {
        success: false,
        error: "El contenido debe ser un JSON válido.",
      };
    }

    await db.insert(safetyTemplates).values({
      id: generateUuid(),
      type: validated.type.trim().toUpperCase(),
      equipmentTypeId: validated.equipmentTypeId || null,
      name: validated.name.trim(),
      version: validated.version?.trim() || "v1.0",
      content: parsedContent,
    });

    revalidatePath("/work-orders");
    return { success: true, message: "Plantilla de seguridad creada correctamente" };
  } catch (error) {
    console.error("Error al crear plantilla de seguridad:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateSafetyTemplate(
  id: string,
  data: Partial<SafetyTemplateFormValues>
) {
  try {
    const updateData: {
      type?: string;
      equipmentTypeId?: string | null;
      name?: string;
      version?: string;
      content?: unknown;
      isActive?: boolean;
    } = {};
    if (data.type) updateData.type = data.type.trim().toUpperCase();
    if (data.equipmentTypeId !== undefined)
      updateData.equipmentTypeId = data.equipmentTypeId || null;
    if (data.name) updateData.name = data.name.trim();
    if (data.version !== undefined) updateData.version = data.version?.trim() || "v1.0";
    if (data.content) {
      try {
        updateData.content = JSON.parse(data.content);
      } catch {
        return { success: false, error: "El contenido debe ser un JSON válido." };
      }
    }

    await db.update(safetyTemplates).set(updateData).where(eq(safetyTemplates.id, id));

    revalidatePath("/work-orders");
    return { success: true, message: "Plantilla de seguridad actualizada" };
  } catch (error) {
    console.error("Error al actualizar plantilla de seguridad:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteSafetyTemplate(id: string) {
  try {
    await db.delete(safetyTemplates).where(eq(safetyTemplates.id, id));
    revalidatePath("/work-orders");
    return { success: true, message: "Plantilla de seguridad eliminada" };
  } catch (error) {
    console.error("Error al eliminar plantilla de seguridad:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}