"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { ZodError } from "zod";
import {
  db,
  contractElevatorModuleExecutions,
  contractElevators,
  contracts,
  elevatorUnities,
  elevatorTypes,
  maintenanceModules,
  maintenanceTasks,
  maintenanceZones,
  pricingConfig,
  workOrders,
  type MaintenanceModule,
  type MaintenanceTask,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import { addMonthsToTimestamp, nowSeconds } from "./constants";
import {
  maintenanceModuleFormSchema,
  maintenanceModulePatchSchema,
  maintenanceTaskBatchSchema,
  maintenanceTaskFormSchema,
  type MaintenanceModuleFormValues,
  type MaintenanceTaskBatchValues,
  type MaintenanceTaskFormValues,
} from "./schema";

/** Normaliza texto para detectar tareas repetidas dentro de una zona. */
function normalizeTaskDescription(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ==========================================
// MÓDULOS
// ==========================================

export type { MaintenanceModule, MaintenanceTask };

export type MaintenanceModuleWithCount = MaintenanceModule & {
  taskCount: number;
  contractCount: number;
};

export async function getMaintenanceModules(elevatorTypeId?: string): Promise<MaintenanceModuleWithCount[]> {
  try {
    return await db
      .select({
        id: maintenanceModules.id,
        code: maintenanceModules.code,
        name: maintenanceModules.name,
        description: maintenanceModules.description,
        frequencyPerYear: maintenanceModules.frequencyPerYear,
        rotationGroup: maintenanceModules.rotationGroup,
        elevatorTypeId: maintenanceModules.elevatorTypeId,
        isActive: maintenanceModules.isActive,
        taskCount: sql<number>`(
          SELECT COUNT(*) FROM maintenance_tasks t
          WHERE t.module_id = ${maintenanceModules.id} AND t.is_active = 1
        )`,
        contractCount: sql<number>`(
          SELECT COUNT(*) FROM contract_elevators ce
          INNER JOIN elevator_unities eu ON ce.elevator_unity_id = eu.id
          WHERE eu.elevator_type_id = ${maintenanceModules.elevatorTypeId}
        )`,
      })
      .from(maintenanceModules)
      .where(elevatorTypeId ? eq(maintenanceModules.elevatorTypeId, elevatorTypeId) : undefined)
      .orderBy(asc(maintenanceModules.code));
  } catch (error) {
    console.error("Error al obtener módulos de mantenimiento:", error);
    return [];
  }
}

export async function getMaintenanceModuleById(id: string) {
  try {
    const rows = await db
      .select()
      .from(maintenanceModules)
      .where(eq(maintenanceModules.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error("Error al obtener el módulo de mantenimiento:", error);
    return null;
  }
}

export async function getMaintenanceElevatorTypes() {
  return db.select().from(elevatorTypes).orderBy(asc(elevatorTypes.name));
}

export async function createMaintenanceModule(
  data: MaintenanceModuleFormValues
) {
  try {
    const validated = maintenanceModuleFormSchema.parse(data);
    const code = validated.code.trim().toUpperCase();

    const [equipmentType] = await db
      .select({ id: elevatorTypes.id })
      .from(elevatorTypes)
      .where(eq(elevatorTypes.id, validated.elevatorTypeId))
      .limit(1);
    if (!equipmentType) {
      return { success: false, error: "El tipo de equipo seleccionado no existe." };
    }

    const existing = await db
      .select({ id: maintenanceModules.id })
      .from(maintenanceModules)
      .where(and(eq(maintenanceModules.code, code), eq(maintenanceModules.elevatorTypeId, validated.elevatorTypeId)))
      .limit(1);
    if (existing.length > 0) {
      return { success: false, error: `El código ${code} ya está en uso.` };
    }

    await db.insert(maintenanceModules).values({
      id: generateUuid(),
      code,
      name: validated.name.trim(),
      description: validated.description?.trim() || null,
      frequencyPerYear: validated.frequencyPerYear,
      rotationGroup: validated.rotationGroup,
      elevatorTypeId: validated.elevatorTypeId,
      isActive: validated.isActive,
    });

    revalidatePath("/configuracion/mantenimiento/modulos");
    return { success: true, message: "Módulo creado correctamente" };
  } catch (error) {
    console.error("Error al crear módulo de mantenimiento:", error);
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? "Revisa los datos del módulo.",
      };
    }
    const rawError = error instanceof Error ? error.message : String(error);
    if (rawError.includes("UNIQUE constraint failed")) {
      return { success: false, error: "El código ya está en uso para este tipo de equipo." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateMaintenanceModule(
  id: string,
  data: Partial<MaintenanceModuleFormValues>
) {
  try {
    const validated = maintenanceModulePatchSchema.parse(data);
    const update: Partial<MaintenanceModule> = {};
    if (validated.code !== undefined) update.code = validated.code.trim().toUpperCase();
    if (validated.name !== undefined) update.name = validated.name.trim();
    if (validated.description !== undefined)
      update.description = validated.description?.trim() || null;
    if (validated.frequencyPerYear !== undefined)
      update.frequencyPerYear = validated.frequencyPerYear;
    if (validated.isActive !== undefined) update.isActive = validated.isActive;
    if (validated.elevatorTypeId !== undefined) update.elevatorTypeId = validated.elevatorTypeId;
    if (validated.rotationGroup !== undefined)
      update.rotationGroup = validated.rotationGroup;

    // Estado actual: hace falta para distinguir "cambió" de "se envió igual".
    const [stored] = await db
      .select({
        code: maintenanceModules.code,
        name: maintenanceModules.name,
        description: maintenanceModules.description,
        frequencyPerYear: maintenanceModules.frequencyPerYear,
        rotationGroup: maintenanceModules.rotationGroup,
        elevatorTypeId: maintenanceModules.elevatorTypeId,
        isActive: maintenanceModules.isActive,
      })
      .from(maintenanceModules)
      .where(eq(maintenanceModules.id, id))
      .limit(1);
    if (!stored) return { success: false, error: "El módulo no existe." };

    // El tipo de equipo solo se bloquea si realmente cambia: el formulario
    // siempre lo envía y antes eso impedía editar cualquier otro campo.
    const typeChanged =
      validated.elevatorTypeId !== undefined &&
      validated.elevatorTypeId !== stored.elevatorTypeId;
    if (typeChanged) {
      const existingTasks = await db.select({ id: maintenanceTasks.id })
        .from(maintenanceTasks).where(eq(maintenanceTasks.moduleId, id)).limit(1);
      if (existingTasks.length > 0) {
        return {
          success: false,
          error:
            "No se puede cambiar el tipo de equipo: el módulo tiene tareas asignadas.",
        };
      }
    }

    if (update.code) {
      const typeCondition = update.elevatorTypeId ?? stored.elevatorTypeId;
      const clash = await db
        .select({ id: maintenanceModules.id })
        .from(maintenanceModules)
        .where(and(
          eq(maintenanceModules.code, update.code),
          typeCondition
            ? eq(maintenanceModules.elevatorTypeId, typeCondition)
            : isNull(maintenanceModules.elevatorTypeId)
        ))
        .limit(1);
      if (clash.length > 0 && clash[0].id !== id) {
        return { success: false, error: `El código ${update.code} ya está en uso.` };
      }
    }

    await db.update(maintenanceModules).set(update).where(eq(maintenanceModules.id, id));

    revalidatePath("/configuracion/mantenimiento/modulos");
    return { success: true, message: "Módulo actualizado correctamente" };
  } catch (error) {
    console.error("Error al actualizar módulo de mantenimiento:", error);
    if (error instanceof ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? "Revisa los datos del módulo.",
      };
    }
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El código de módulo ya está en uso." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function toggleMaintenanceModule(id: string, isActive: boolean) {
  try {
    await db
      .update(maintenanceModules)
      .set({ isActive })
      .where(eq(maintenanceModules.id, id));

    revalidatePath("/configuracion/mantenimiento/modulos");
    return {
      success: true,
      message: isActive ? "Módulo activado" : "Módulo desactivado",
    };
  } catch (error) {
    console.error("Error al cambiar el estado del módulo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// TAREAS
// ==========================================

export type MaintenanceTaskWithModule = Omit<MaintenanceTask, "zone"> & {
  zone: string | null;
  zoneId: string | null;
  module_code?: string | null;
};

export async function getMaintenanceTasks(
  moduleId: string
): Promise<MaintenanceTaskWithModule[]> {
  try {
    return await db
      .select({
        id: maintenanceTasks.id,
        moduleId: maintenanceTasks.moduleId,
        zoneId: maintenanceTasks.zoneId,
        zone: maintenanceZones.name,
        description: maintenanceTasks.description,
        isCritical: maintenanceTasks.isCritical,
        orderIndex: maintenanceTasks.orderIndex,
        requiresPhoto: maintenanceTasks.requiresPhoto,
        isActive: maintenanceTasks.isActive,
        module_code: maintenanceModules.code,
      })
      .from(maintenanceTasks)
      .leftJoin(maintenanceModules, eq(maintenanceTasks.moduleId, maintenanceModules.id))
      .leftJoin(maintenanceZones, eq(maintenanceTasks.zoneId, maintenanceZones.id))
      .where(eq(maintenanceTasks.moduleId, moduleId))
      .orderBy(asc(maintenanceZones.orderIndex), asc(maintenanceTasks.orderIndex));
  } catch (error) {
    console.error("Error al obtener tareas del módulo:", error);
    return [];
  }
}

export async function createMaintenanceTask(
  moduleId: string,
  data: MaintenanceTaskFormValues
) {
  try {
    const validated = maintenanceTaskFormSchema.parse(data);

    const existingModule = await db
      .select({ id: maintenanceModules.id, elevatorTypeId: maintenanceModules.elevatorTypeId })
      .from(maintenanceModules)
      .where(eq(maintenanceModules.id, moduleId))
      .limit(1);
    if (existingModule.length === 0) {
      return { success: false, error: "El módulo no existe." };
    }

    const zone = await db
      .select({ id: maintenanceZones.id, name: maintenanceZones.name, elevatorTypeId: maintenanceZones.elevatorTypeId })
      .from(maintenanceZones)
      .where(and(eq(maintenanceZones.id, validated.zoneId), eq(maintenanceZones.isActive, true)))
      .limit(1);
    if (zone.length === 0) return { success: false, error: "La zona no existe o está inactiva." };
    if (zone[0].elevatorTypeId !== existingModule[0].elevatorTypeId) {
      return { success: false, error: "La zona no pertenece al tipo de equipo del módulo." };
    }

    // El order_index se genera al final de la zona para no chocar.
    const [{ nextIndex }] = await db
      .select({ nextIndex: max(maintenanceTasks.orderIndex) })
      .from(maintenanceTasks)
      .where(
        and(
          eq(maintenanceTasks.moduleId, moduleId),
          eq(maintenanceTasks.zoneId, validated.zoneId)
        )
      );

    await db.insert(maintenanceTasks).values({
      id: generateUuid(),
      moduleId,
      zone: zone[0].name,
      zoneId: validated.zoneId,
      description: validated.description.trim(),
      isCritical: validated.isCritical,
      requiresPhoto: validated.requiresPhoto,
      orderIndex: (nextIndex ?? 0) + 1,
    });

    revalidatePath("/configuracion/mantenimiento/modulos");
    revalidatePath(`/configuracion/mantenimiento/modulos/${moduleId}/tareas`);
    return { success: true, message: "Tarea creada correctamente" };
  } catch (error) {
    console.error("Error al crear tarea de mantenimiento:", error);
    const rawError = error instanceof Error ? error.message : String(error);
    if (rawError.includes("zone_id") || rawError.includes("maintenance_zones")) {
      return {
        success: false,
        error: "La base de datos no tiene aplicada la migración 0027 de zonas de mantenimiento.",
      };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Alta por lotes de tareas dentro de una zona del módulo.
 * Las tareas se registran en el orden en que aparecen en el JSON:
 * la primera toma el siguiente `order_index` y así sucesivamente.
 */
export async function createMaintenanceTasksBatch(
  moduleId: string,
  data: MaintenanceTaskBatchValues
) {
  try {
    const validated = maintenanceTaskBatchSchema.parse(data);

    const existingModule = await db
      .select({
        id: maintenanceModules.id,
        elevatorTypeId: maintenanceModules.elevatorTypeId,
      })
      .from(maintenanceModules)
      .where(eq(maintenanceModules.id, moduleId))
      .limit(1);
    if (existingModule.length === 0) {
      return { success: false, error: "El módulo no existe." };
    }

    const zone = await db
      .select({
        id: maintenanceZones.id,
        name: maintenanceZones.name,
        elevatorTypeId: maintenanceZones.elevatorTypeId,
      })
      .from(maintenanceZones)
      .where(
        and(
          eq(maintenanceZones.id, validated.zoneId),
          eq(maintenanceZones.isActive, true)
        )
      )
      .limit(1);
    if (zone.length === 0) {
      return { success: false, error: "La zona no existe o está inactiva." };
    }
    if (zone[0].elevatorTypeId !== existingModule[0].elevatorTypeId) {
      return {
        success: false,
        error: "La zona no pertenece al tipo de equipo del módulo.",
      };
    }

    // Tareas repetidas dentro del propio lote.
    const seen = new Set<string>();
    const repeatedInBatch: string[] = [];
    for (const task of validated.tasks) {
      const key = normalizeTaskDescription(task.description);
      if (seen.has(key)) repeatedInBatch.push(task.description);
      seen.add(key);
    }
    if (repeatedInBatch.length > 0) {
      return {
        success: false,
        error: `El lote repite ${repeatedInBatch.length} tarea(s): "${repeatedInBatch
          .slice(0, 3)
          .join('" | "')}"`,
      };
    }

    // Tareas que ya existen en la misma zona del módulo.
    const current = await db
      .select({ description: maintenanceTasks.description })
      .from(maintenanceTasks)
      .where(
        and(
          eq(maintenanceTasks.moduleId, moduleId),
          eq(maintenanceTasks.zoneId, validated.zoneId)
        )
      );
    const existingKeys = new Set(
      current.map((row) => normalizeTaskDescription(row.description))
    );
    const alreadyRegistered = validated.tasks
      .filter((task) => existingKeys.has(normalizeTaskDescription(task.description)))
      .map((task) => task.description);
    if (alreadyRegistered.length > 0) {
      return {
        success: false,
        error: `${alreadyRegistered.length} tarea(s) ya existen en ${zone[0].name}: "${alreadyRegistered
          .slice(0, 3)
          .join('" | "')}"`,
      };
    }

    const [{ nextIndex }] = await db
      .select({ nextIndex: max(maintenanceTasks.orderIndex) })
      .from(maintenanceTasks)
      .where(
        and(
          eq(maintenanceTasks.moduleId, moduleId),
          eq(maintenanceTasks.zoneId, validated.zoneId)
        )
      );

    let order = nextIndex ?? 0;
    const rows = validated.tasks.map((task) => {
      order += 1;
      return {
        id: generateUuid(),
        moduleId,
        zone: zone[0].name,
        zoneId: validated.zoneId,
        description: task.description.trim(),
        isCritical: task.isCritical,
        requiresPhoto: task.requiresPhoto,
        orderIndex: order,
      };
    });

    await db.transaction(async (tx) => {
      await tx.insert(maintenanceTasks).values(rows);
    });

    revalidatePath("/configuracion/mantenimiento/modulos");
    revalidatePath(`/configuracion/mantenimiento/modulos/${moduleId}/tareas`);
    return {
      success: true,
      message: `${rows.length} tarea(s) agregadas a ${zone[0].name}`,
      count: rows.length,
    };
  } catch (error) {
    console.error("Error al crear tareas de mantenimiento por lotes:", error);
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      return {
        success: false,
        error: issue?.message ?? "Revisa el JSON de las tareas.",
      };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateMaintenanceTask(
  id: string,
  data: Partial<MaintenanceTaskFormValues>
) {
  try {
    const validated = maintenanceTaskFormSchema.partial().parse(data);

    const current = await db
      .select({
        moduleId: maintenanceTasks.moduleId,
        zoneId: maintenanceTasks.zoneId,
        moduleTypeId: maintenanceModules.elevatorTypeId,
      })
      .from(maintenanceTasks)
      .innerJoin(maintenanceModules, eq(maintenanceTasks.moduleId, maintenanceModules.id))
      .where(eq(maintenanceTasks.id, id))
      .limit(1);
    if (current.length === 0) {
      return { success: false, error: "La tarea no existe." };
    }
    const previousZone = current[0].zoneId;
    const moduleId = current[0].moduleId;
    const zoneChanged = validated.zoneId !== undefined && validated.zoneId !== previousZone;

    const update: Partial<MaintenanceTask> = {};
    if (validated.zoneId !== undefined) {
      const zone = await db.select({ name: maintenanceZones.name, elevatorTypeId: maintenanceZones.elevatorTypeId }).from(maintenanceZones)
        .where(and(eq(maintenanceZones.id, validated.zoneId), eq(maintenanceZones.isActive, true))).limit(1);
      if (zone.length === 0) return { success: false, error: "La zona no existe o está inactiva." };
      if (zone[0].elevatorTypeId !== current[0].moduleTypeId) return { success: false, error: "La zona no pertenece al tipo de equipo del módulo." };
      update.zoneId = validated.zoneId;
      update.zone = zone[0].name;
    }
    if (validated.description !== undefined)
      update.description = validated.description.trim();
    if (validated.isCritical !== undefined) update.isCritical = validated.isCritical;
    if (validated.requiresPhoto !== undefined)
      update.requiresPhoto = validated.requiresPhoto;

    if (zoneChanged && validated.zoneId) {
      // Al cambiar de zona la tarea se coloca al final de la nueva zona.
      const [{ nextIndex }] = await db
        .select({ nextIndex: max(maintenanceTasks.orderIndex) })
        .from(maintenanceTasks)
        .where(
          and(
            eq(maintenanceTasks.moduleId, moduleId),
            eq(maintenanceTasks.zoneId, validated.zoneId)
          )
        );
      update.orderIndex = (nextIndex ?? 0) + 1;
    }

    await db.transaction(async (tx) => {
      await tx.update(maintenanceTasks).set(update).where(eq(maintenanceTasks.id, id));

      // La zona de origen queda renumerada para no dejar huecos.
      if (zoneChanged && previousZone) {
        const remaining = await tx
          .select({ id: maintenanceTasks.id })
          .from(maintenanceTasks)
          .where(
            and(
              eq(maintenanceTasks.moduleId, moduleId),
              eq(maintenanceTasks.zoneId, previousZone)
            )
          )
          .orderBy(asc(maintenanceTasks.orderIndex));
        for (const [index, row] of remaining.entries()) {
          await tx
            .update(maintenanceTasks)
            .set({ orderIndex: index + 1 })
            .where(eq(maintenanceTasks.id, row.id));
        }
      }
    });

    revalidatePath("/configuracion/mantenimiento/modulos");
    revalidatePath(`/configuracion/mantenimiento/modulos/${moduleId}/tareas`);
    return { success: true, message: "Tarea actualizada correctamente" };
  } catch (error) {
    console.error("Error al actualizar tarea de mantenimiento:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteMaintenanceTask(id: string) {
  try {
    const task = await db
      .select({
        moduleId: maintenanceTasks.moduleId,
        zoneId: maintenanceTasks.zoneId,
      })
      .from(maintenanceTasks)
      .where(eq(maintenanceTasks.id, id))
      .limit(1);
    if (task.length === 0) {
      return { success: false, error: "La tarea no existe." };
    }
    const { moduleId, zoneId } = task[0];
    if (!zoneId) return { success: false, error: "La tarea no tiene una zona válida." };

    await db.transaction(async (tx) => {
      await tx.delete(maintenanceTasks).where(eq(maintenanceTasks.id, id));
      // Renumera la zona para mantener la secuencia 1..N.
      const remaining = await tx
        .select({ id: maintenanceTasks.id })
        .from(maintenanceTasks)
        .where(
          and(
            eq(maintenanceTasks.moduleId, moduleId),
            eq(maintenanceTasks.zoneId, zoneId)
          )
        )
        .orderBy(asc(maintenanceTasks.orderIndex));
      for (const [index, row] of remaining.entries()) {
        await tx
          .update(maintenanceTasks)
          .set({ orderIndex: index + 1 })
          .where(eq(maintenanceTasks.id, row.id));
      }
    });

    revalidatePath("/configuracion/mantenimiento/modulos");
    revalidatePath(`/configuracion/mantenimiento/modulos/${moduleId}/tareas`);
    return { success: true, message: "Tarea eliminada" };
  } catch (error) {
    console.error("Error al eliminar tarea de mantenimiento:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Reordena las tareas de una zona y renumera del 1 al N.
 * `orderedIds` es el nuevo orden completo de la zona.
 */
export async function reorderMaintenanceTasks(
  moduleId: string,
  zone: string,
  orderedIds: string[]
) {
  try {
    if (orderedIds.length === 0) {
      return { success: true, message: "Nada que reordenar" };
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(maintenanceTasks)
          .set({ orderIndex: i + 1 })
          .where(
            and(
              eq(maintenanceTasks.id, orderedIds[i]),
              eq(maintenanceTasks.moduleId, moduleId),
              eq(maintenanceTasks.zoneId, zone)
            )
          );
      }
    });

    revalidatePath(`/configuracion/mantenimiento/modulos/${moduleId}/tareas`);
    return { success: true, message: "Orden actualizado" };
  } catch (error) {
    console.error("Error al reordenar tareas de mantenimiento:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// PLAN POR ASCENSOR CONTRATADO
// ==========================================
// El plan se deriva del tipo de equipo: los módulos activos cuyo
// `elevator_type_id` coincide con el del ascensor. La rotación vive en
// `maintenance_modules.rotation_group` y la frecuencia en
// `maintenance_modules.frequency_per_year`; el histórico de ejecuciones está en
// `contract_elevator_module_executions`. No hay asignaciones por equipo.

export type ContractElevatorModuleRow = {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  moduleFrequencyPerYear: number;
  moduleRotationGroup: number | null;
  /** Meses entre visitas, derivado de `frequencyPerYear`. */
  frequencyMonths: number;
  /** Última ejecución según el histórico. */
  lastExecutedAt: number | null;
  nextDueAt: number;
  /** Inicio del contrato y frecuencia de mantenimiento, para el calendario. */
  contractStartDate: number;
  contractFrequencyMonths: number | null;
};

/** Meses entre visitas a partir de la frecuencia anual del módulo. */
function frequencyMonthsFromPerYear(frequencyPerYear: number): number {
  if (!Number.isFinite(frequencyPerYear) || frequencyPerYear <= 0) return 12;
  return Math.max(1, Math.min(60, Math.round(12 / frequencyPerYear)));
}

/** Último `executedAt` por módulo para un ascensor contratado. */
async function getLastExecutionsByModule(
  contractElevatorId: string
): Promise<Map<string, number | null>> {
  const rows = await db
    .select({
      moduleId: contractElevatorModuleExecutions.moduleId,
      lastExecutedAt: max(contractElevatorModuleExecutions.executedAt),
    })
    .from(contractElevatorModuleExecutions)
    .where(eq(contractElevatorModuleExecutions.contractElevatorId, contractElevatorId))
    .groupBy(contractElevatorModuleExecutions.moduleId);
  return new Map(rows.map((r) => [r.moduleId, r.lastExecutedAt]));
}

export async function getContractElevatorModules(
  contractElevatorId: string
): Promise<ContractElevatorModuleRow[]> {
  try {
    const [context] = await db
      .select({
        elevatorTypeId: elevatorUnities.elevatorTypeId,
        startDate: contracts.startDate,
        maintenanceFrequencyMonths: contracts.maintenanceFrequencyMonths,
      })
      .from(contractElevators)
      .innerJoin(
        elevatorUnities,
        eq(contractElevators.elevatorUnityId, elevatorUnities.id)
      )
      .innerJoin(contracts, eq(contractElevators.contractId, contracts.id))
      .where(eq(contractElevators.id, contractElevatorId))
      .limit(1);
    if (!context) return [];

    const modules = await db
      .select({
        moduleId: maintenanceModules.id,
        moduleCode: maintenanceModules.code,
        moduleName: maintenanceModules.name,
        moduleFrequencyPerYear: maintenanceModules.frequencyPerYear,
        moduleRotationGroup: maintenanceModules.rotationGroup,
      })
      .from(maintenanceModules)
      .where(
        and(
          eq(maintenanceModules.elevatorTypeId, context.elevatorTypeId),
          eq(maintenanceModules.isActive, true)
        )
      )
      .orderBy(asc(maintenanceModules.code));
    if (modules.length === 0) return [];

    const lastByModule = await getLastExecutionsByModule(contractElevatorId);
    const contractStart = context.startDate ?? nowSeconds();

    return modules.map((module) => {
      const frequencyMonths = frequencyMonthsFromPerYear(module.moduleFrequencyPerYear);
      const lastExecutedAt = lastByModule.get(module.moduleId) ?? null;
      return {
        ...module,
        frequencyMonths,
        lastExecutedAt,
        // Sin ejecuciones, el primer vencimiento se cuenta desde el inicio del
        // contrato; con historial, desde la última ejecución.
        nextDueAt: addMonthsToTimestamp(
          lastExecutedAt ?? contractStart,
          frequencyMonths
        ),
        contractStartDate: contractStart,
        contractFrequencyMonths: context.maintenanceFrequencyMonths,
      };
    });
  } catch (error) {
    console.error("Error al obtener el plan de mantenimiento:", error);
    return [];
  }
}

/**
 * Registra la ejecución de módulos en el histórico. El plan no se persiste:
 * se valida que los módulos correspondan al tipo de equipo del ascensor.
 */
export async function recordModuleExecution(
  contractElevatorId: string,
  moduleIds: string[],
  workOrderId: string,
  technicianId?: string | null,
  notes?: string | null,
  executedAt: number = nowSeconds()
) {
  try {
    if (moduleIds.length === 0) return { success: true, message: "Sin módulos" };

    const [workOrder] = await db
      .select({ status: workOrders.status })
      .from(workOrders)
      .where(eq(workOrders.id, workOrderId))
      .limit(1);
    if (!workOrder) return { success: false, error: "La orden de trabajo no existe." };
    if (workOrder.status !== "COMPLETED") {
      return {
        success: false,
        error: "Solo se pueden registrar ejecuciones de una OT completada.",
      };
    }

    const [context] = await db
      .select({ elevatorTypeId: elevatorUnities.elevatorTypeId })
      .from(contractElevators)
      .innerJoin(
        elevatorUnities,
        eq(contractElevators.elevatorUnityId, elevatorUnities.id)
      )
      .where(eq(contractElevators.id, contractElevatorId))
      .limit(1);
    if (!context) {
      return { success: false, error: "El ascensor contratado no existe." };
    }

    const validModules = await db
      .select({ id: maintenanceModules.id })
      .from(maintenanceModules)
      .where(
        and(
          inArray(maintenanceModules.id, moduleIds),
          eq(maintenanceModules.elevatorTypeId, context.elevatorTypeId),
          eq(maintenanceModules.isActive, true)
        )
      );
    if (validModules.length === 0) {
      return {
        success: false,
        error: "Los módulos no corresponden al tipo de equipo de este ascensor.",
      };
    }

    await db.transaction(async (tx) => {
      for (const targetModule of validModules) {
        await tx
          .insert(contractElevatorModuleExecutions)
          .values({
            id: generateUuid(),
            contractElevatorId,
            moduleId: targetModule.id,
            workOrderId,
            executedAt,
            technicianId: technicianId ?? null,
            notes: notes?.trim() || null,
          })
          .onConflictDoNothing();
      }
    });

    revalidatePath("/contracts");
    return { success: true, message: "Ejecuciones registradas" };
  } catch (error) {
    console.error("Error al registrar la ejecución de módulos:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function getModuleExecutionHistory(
  contractElevatorId: string,
  moduleId?: string
) {
  try {
    const conditions = [eq(contractElevatorModuleExecutions.contractElevatorId, contractElevatorId)];
    if (moduleId) conditions.push(eq(contractElevatorModuleExecutions.moduleId, moduleId));

    return await db
      .select({
        id: contractElevatorModuleExecutions.id,
        moduleId: contractElevatorModuleExecutions.moduleId,
        workOrderId: contractElevatorModuleExecutions.workOrderId,
        executedAt: contractElevatorModuleExecutions.executedAt,
        technicianId: contractElevatorModuleExecutions.technicianId,
        notes: contractElevatorModuleExecutions.notes,
        moduleCode: maintenanceModules.code,
        moduleName: maintenanceModules.name,
      })
      .from(contractElevatorModuleExecutions)
      .innerJoin(
        maintenanceModules,
        eq(contractElevatorModuleExecutions.moduleId, maintenanceModules.id)
      )
      .where(and(...conditions))
      .orderBy(sql`${contractElevatorModuleExecutions.executedAt} DESC`);
  } catch (error) {
    console.error("Error al obtener el historial de ejecuciones:", error);
    return [];
  }
}

export async function getActiveMaintenanceModules(): Promise<MaintenanceModule[]> {
  try {
    return await db
      .select()
      .from(maintenanceModules)
      .where(eq(maintenanceModules.isActive, true))
      .orderBy(asc(maintenanceModules.code));
  } catch (error) {
    console.error("Error al obtener los módulos activos:", error);
    return [];
  }
}

export async function getActiveMaintenanceZones(elevatorTypeId?: string | null) {
  return db.select().from(maintenanceZones)
    .where(and(eq(maintenanceZones.isActive, true), elevatorTypeId ? eq(maintenanceZones.elevatorTypeId, elevatorTypeId) : undefined))
    .orderBy(asc(maintenanceZones.orderIndex));
}

/** Siguiente vencimiento global, para vistas de calendario/alertas. */
export async function getUpcomingModuleDeadlines(limit = 20) {
  try {
    const [config] = await db
      .select({ graceDays: pricingConfig.maintenanceGraceDays })
      .from(pricingConfig)
      .limit(1);
    const graceDays = config?.graceDays ?? 15;
    const horizon = nowSeconds() + graceDays * 24 * 60 * 60;

    // Plan derivado: módulos activos del tipo de cada ascensor contratado.
    const plan = await db
      .select({
        contractElevatorId: contractElevators.id,
        elevatorCode: elevatorUnities.internalCode,
        moduleId: maintenanceModules.id,
        moduleCode: maintenanceModules.code,
        moduleName: maintenanceModules.name,
        frequencyPerYear: maintenanceModules.frequencyPerYear,
        contractStartDate: contracts.startDate,
      })
      .from(contractElevators)
      .innerJoin(contracts, eq(contractElevators.contractId, contracts.id))
      .innerJoin(
        elevatorUnities,
        eq(contractElevators.elevatorUnityId, elevatorUnities.id)
      )
      .innerJoin(
        maintenanceModules,
        eq(maintenanceModules.elevatorTypeId, elevatorUnities.elevatorTypeId)
      )
      .where(eq(maintenanceModules.isActive, true));

    const lastExecutions = await db
      .select({
        contractElevatorId: contractElevatorModuleExecutions.contractElevatorId,
        moduleId: contractElevatorModuleExecutions.moduleId,
        lastExecutedAt: max(contractElevatorModuleExecutions.executedAt),
      })
      .from(contractElevatorModuleExecutions)
      .groupBy(
        contractElevatorModuleExecutions.contractElevatorId,
        contractElevatorModuleExecutions.moduleId
      );
    const lastByKey = new Map(
      lastExecutions.map((row) => [
        `${row.contractElevatorId}:${row.moduleId}`,
        row.lastExecutedAt,
      ])
    );

    const now = nowSeconds();
    return plan
      .map((row) => {
        const lastExecutedAt =
          lastByKey.get(`${row.contractElevatorId}:${row.moduleId}`) ?? null;
        return {
          id: `${row.contractElevatorId}:${row.moduleId}`,
          contractElevatorId: row.contractElevatorId,
          moduleCode: row.moduleCode,
          moduleName: row.moduleName,
          elevatorCode: row.elevatorCode,
          nextDueAt: addMonthsToTimestamp(
            lastExecutedAt ?? row.contractStartDate ?? now,
            frequencyMonthsFromPerYear(row.frequencyPerYear)
          ),
        };
      })
      .filter((row) => row.nextDueAt <= horizon)
      .sort((a, b) => a.nextDueAt - b.nextDueAt)
      .slice(0, limit);
  } catch (error) {
    console.error("Error al obtener los vencimientos próximos:", error);
    return [];
  }
}
