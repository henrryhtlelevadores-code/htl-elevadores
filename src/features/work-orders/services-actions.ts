"use server";

import { revalidatePath } from "next/cache";
import { asc, eq, inArray } from "drizzle-orm";
import {
  db,
  serviceTypes,
  workOrders,
  workOrderServices,
  workOrderServiceTasks,
  type WorkOrderService,
  type WorkOrderServiceTask,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import { denyUnless, requirePermission } from "@/features/auth/guard";

/**
 * Servicios generales de una OT (limpieza, jardinería, etc.): el hermano de
 * `work_order_elevators` para las OT que no atienden ascensores.
 */

export type WorkOrderServiceWithRelations = WorkOrderService & {
  service_type_name: string | null;
  tasks: WorkOrderServiceTask[];
};

const SERVICE_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

export async function getWorkOrderServices(): Promise<WorkOrderServiceWithRelations[]> {
  await requirePermission("work_orders:panel:read");
  try {
    const rows = await db
      .select({
        id: workOrderServices.id,
        workOrderId: workOrderServices.workOrderId,
        serviceTypeId: workOrderServices.serviceTypeId,
        locationDescription: workOrderServices.locationDescription,
        description: workOrderServices.description,
        status: workOrderServices.status,
        startedAt: workOrderServices.startedAt,
        completedAt: workOrderServices.completedAt,
        finalStatus: workOrderServices.finalStatus,
        observations: workOrderServices.observations,
        orderIndex: workOrderServices.orderIndex,
        createdAt: workOrderServices.createdAt,
        service_type_name: serviceTypes.name,
      })
      .from(workOrderServices)
      .leftJoin(serviceTypes, eq(workOrderServices.serviceTypeId, serviceTypes.id))
      .orderBy(asc(workOrderServices.orderIndex));
    if (rows.length === 0) return [];

    const taskRows = await db
      .select()
      .from(workOrderServiceTasks)
      .where(
        inArray(
          workOrderServiceTasks.workOrderServiceId,
          rows.map((row) => row.id)
        )
      )
      .orderBy(asc(workOrderServiceTasks.orderIndex));
    const tasksByService = new Map<string, WorkOrderServiceTask[]>();
    for (const task of taskRows) {
      const list = tasksByService.get(task.workOrderServiceId) ?? [];
      list.push(task);
      tasksByService.set(task.workOrderServiceId, list);
    }

    return rows.map((row) => ({ ...row, tasks: tasksByService.get(row.id) ?? [] }));
  } catch (error) {
    console.error("Error al obtener servicios de la OT:", error);
    return [];
  }
}

/** Una OT aprobada ya no admite cambios, tampoco en sus servicios. */
async function lockedMessage(workOrderServiceId: string): Promise<string | null> {
  const [row] = await db
    .select({ approvalStatus: workOrders.approvalStatus })
    .from(workOrderServices)
    .innerJoin(workOrders, eq(workOrderServices.workOrderId, workOrders.id))
    .where(eq(workOrderServices.id, workOrderServiceId))
    .limit(1);
  if (!row) return "El servicio ya no existe.";
  return row.approvalStatus === "APPROVED" ? "La OT aprobada ya no admite cambios." : null;
}

async function serviceIdOfTask(taskId: string): Promise<string | null> {
  const [row] = await db
    .select({ workOrderServiceId: workOrderServiceTasks.workOrderServiceId })
    .from(workOrderServiceTasks)
    .where(eq(workOrderServiceTasks.id, taskId))
    .limit(1);
  return row?.workOrderServiceId ?? null;
}

export async function updateWorkOrderServiceStatus(id: string, status: string) {
  const denied = await denyUnless("work_orders:panel:write");
  if (denied) return denied;
  try {
    if (!SERVICE_STATUSES.includes(status as (typeof SERVICE_STATUSES)[number])) {
      return { success: false, error: "Estado no válido." };
    }
    const locked = await lockedMessage(id);
    if (locked) return { success: false, error: locked };

    const [current] = await db
      .select({ startedAt: workOrderServices.startedAt })
      .from(workOrderServices)
      .where(eq(workOrderServices.id, id))
      .limit(1);
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(workOrderServices)
      .set({
        status,
        startedAt: status === "PENDING" ? null : (current?.startedAt ?? now),
        completedAt: status === "COMPLETED" ? now : null,
      })
      .where(eq(workOrderServices.id, id));

    revalidatePath("/work-orders");
    return { success: true, message: "Estado del servicio actualizado" };
  } catch (error) {
    console.error("Error al actualizar estado del servicio:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function createWorkOrderServiceTask(
  workOrderServiceId: string,
  taskDescription: string
) {
  const denied = await denyUnless("work_orders:panel:write");
  if (denied) return denied;
  try {
    const description = taskDescription.trim();
    if (description.length < 2) return { success: false, error: "Describe la tarea." };
    if (description.length > 300) return { success: false, error: "Máximo 300 caracteres." };
    const locked = await lockedMessage(workOrderServiceId);
    if (locked) return { success: false, error: locked };

    const task = {
      id: generateUuid(),
      workOrderServiceId,
      taskDescription: description,
      orderIndex: Math.floor(Date.now() / 1000),
    };
    await db.insert(workOrderServiceTasks).values(task);
    revalidatePath("/work-orders");
    return { success: true, message: "Tarea agregada correctamente", id: task.id };
  } catch (error) {
    console.error("Error al crear tarea de servicio:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function toggleWorkOrderServiceTask(id: string, isCompleted: boolean) {
  const denied = await denyUnless("work_orders:panel:write");
  if (denied) return denied;
  try {
    const serviceId = await serviceIdOfTask(id);
    if (!serviceId) return { success: false, error: "La tarea ya no existe." };
    const locked = await lockedMessage(serviceId);
    if (locked) return { success: false, error: locked };

    await db
      .update(workOrderServiceTasks)
      .set({
        isCompleted,
        status: isCompleted ? "COMPLETED" : "PENDING",
        completedAt: isCompleted ? Math.floor(Date.now() / 1000) : null,
      })
      .where(eq(workOrderServiceTasks.id, id));
    revalidatePath("/work-orders");
    return { success: true, message: isCompleted ? "Tarea completada" : "Tarea marcada como pendiente" };
  } catch (error) {
    console.error("Error al actualizar tarea de servicio:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteWorkOrderServiceTask(id: string) {
  const denied = await denyUnless("work_orders:panel:write");
  if (denied) return denied;
  try {
    const serviceId = await serviceIdOfTask(id);
    if (!serviceId) return { success: true, message: "Tarea eliminada correctamente" };
    const locked = await lockedMessage(serviceId);
    if (locked) return { success: false, error: locked };

    await db.delete(workOrderServiceTasks).where(eq(workOrderServiceTasks.id, id));
    revalidatePath("/work-orders");
    return { success: true, message: "Tarea eliminada correctamente" };
  } catch (error) {
    console.error("Error al eliminar tarea de servicio:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
