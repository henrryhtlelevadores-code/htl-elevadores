"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  serviceTypes,
  costCenters,
  clients,
  users,
  staffProfiles,
  elevatorUnities,
  type WorkOrder,
  type WorkOrderElevator,
  type WorkOrderTask,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import {
  workOrderFormSchema,
  workOrderElevatorFormSchema,
  workOrderTaskFormSchema,
  type WorkOrderFormValues,
  type WorkOrderElevatorFormValues,
  type WorkOrderTaskFormValues,
} from "./schema";
import { eq, asc, desc, and, isNull, count, inArray, like, or } from "drizzle-orm";
import { type BatchItem } from "drizzle-orm/batch";

export type WorkOrderWithRelations = WorkOrder & {
  cost_center_name?: string | null;
  client_name?: string | null;
  technician_name?: string | null;
};

// ==========================================
// 1. ÓRDENES DE TRABAJO
// ==========================================

export interface WorkOrdersFormData {
  clients: Array<{ id: string; legalName: string }>;
  costCenters: Array<{ id: string; name: string; client_name: string; clientId: string }>;
  technicians: Array<{ id: string; fullName: string; jobTitle: string | null }>;
  equipmentOptions: Array<{
    id: string;
    internalCode: string;
    name: string;
    costCenterId: string;
  }>;
  serviceTypes: ServiceTypeOption[];
}

export type ServiceTypeOption = {
  id: string;
  code: string;
  name: string;
  category: string;
};

export async function getServiceTypes(): Promise<ServiceTypeOption[]> {
  try {
    return await db
      .select({
        id: serviceTypes.id,
        code: serviceTypes.code,
        name: serviceTypes.name,
        category: serviceTypes.category,
      })
      .from(serviceTypes)
      .where(eq(serviceTypes.isActive, true))
      .orderBy(asc(serviceTypes.category), asc(serviceTypes.code));
  } catch (error) {
    console.error("Error al obtener tipos de servicio:", error);
    return [];
  }
}

export async function getNextOtNumber(isoDate: string) {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return { otNumber: "" };
    const [y, m] = isoDate.split("-").map(Number);
    const monthLabel = `${y}-${String(m).padStart(2, "0")}`;
    const [{ total }] = await db
      .select({ total: count() })
      .from(workOrders)
      .where(like(workOrders.otNumber, `OT-${monthLabel}-%`));
    return { otNumber: `OT-${monthLabel}-${String((total ?? 0) + 1).padStart(4, "0")}` };
  } catch (error) {
    console.error("Error al generar número de OT:", error);
    return { otNumber: "" };
  }
}

export async function getWorkOrdersFormData(): Promise<WorkOrdersFormData> {
  const [clientRes, ccRes, techRes, eqRes, serviceTypeRes] = await Promise.all([
    db
      .select({ id: clients.id, legalName: clients.legalName })
      .from(clients)
      .where(isNull(clients.deletedAt))
      .orderBy(asc(clients.legalName)),
    db
      .select({
        id: costCenters.id,
        name: costCenters.name,
        client_name: clients.legalName,
        clientId: costCenters.clientId,
      })
      .from(costCenters)
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .where(isNull(costCenters.deletedAt))
      .orderBy(asc(costCenters.name)),
    db
      .select({ id: users.id, fullName: users.fullName, jobTitle: staffProfiles.specialization })
      .from(users)
      .leftJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .orderBy(asc(users.fullName)),
    db
      .select({
        id: elevatorUnities.id,
        internalCode: elevatorUnities.internalCode,
        name: elevatorUnities.name,
        costCenterId: elevatorUnities.costCenterId,
      })
      .from(elevatorUnities)
      .where(isNull(elevatorUnities.deletedAt))
      .orderBy(asc(elevatorUnities.internalCode)),
    getServiceTypes(),
  ]);

  return { clients: clientRes, costCenters: ccRes, technicians: techRes, equipmentOptions: eqRes, serviceTypes: serviceTypeRes };
}

export async function getWorkOrders(): Promise<WorkOrderWithRelations[]> {
  try {
    return await db
      .select({
        id: workOrders.id,
        otNumber: workOrders.otNumber,
        costCenterId: workOrders.costCenterId,
        serviceTypeId: workOrders.serviceTypeId,
        technicianId: workOrders.technicianId,
        type: workOrders.type,
        status: workOrders.status,
        priority: workOrders.priority,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        startedAt: workOrders.startedAt,
        completedAt: workOrders.completedAt,
        checkinLatitude: workOrders.checkinLatitude,
        checkinLongitude: workOrders.checkinLongitude,
        closingNotes: workOrders.closingNotes,
        clientSignatureUrl: workOrders.clientSignatureUrl,
        clientSignerName: workOrders.clientSignerName,
        createdAt: workOrders.createdAt,
        deletedAt: workOrders.deletedAt,
        cost_center_name: costCenters.name,
        client_name: clients.legalName,
        technician_name: users.fullName,
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .leftJoin(users, eq(workOrders.technicianId, users.id))
      .where(isNull(workOrders.deletedAt))
      .orderBy(desc(workOrders.createdAt));
  } catch (error) {
    console.error("Error al obtener órdenes de trabajo:", error);
    return [];
  }
}

export async function createWorkOrder(data: WorkOrderFormValues) {
  try {
    const validated = workOrderFormSchema.parse(data);

    const isoDate = validated.scheduledDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return { success: false, error: "La fecha programada es obligatoria." };
    }
    const [y, m] = isoDate.split("-").map(Number);
    const monthLabel = `${y}-${String(m).padStart(2, "0")}`;
    const monthPrefix = `${monthLabel}-%`;

    const serviceTypeRows = await db
      .select({ id: serviceTypes.id, code: serviceTypes.code, name: serviceTypes.name })
      .from(serviceTypes)
      .where(eq(serviceTypes.id, validated.serviceTypeId))
      .limit(1);
    const serviceType = serviceTypeRows[0];
    if (!serviceType) {
      return { success: false, error: "Selecciona un tipo de servicio válido." };
    }

    const elevatorIds = validated.elevatorUnityIds ?? [];

    if (serviceType.code === "PREV") {
      if (elevatorIds.length === 0) {
        return {
          success: false,
          error: "Para un mantenimiento preventivo debes seleccionar al menos un equipo.",
        };
      }
      const conflicts = await db
        .select({
          otNumber: workOrders.otNumber,
          internalCode: elevatorUnities.internalCode,
        })
        .from(workOrderElevators)
        .innerJoin(workOrders, eq(workOrderElevators.workOrderId, workOrders.id))
        .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
        .where(
          and(
            isNull(workOrders.deletedAt),
            inArray(workOrderElevators.elevatorUnityId, elevatorIds),
            or(eq(workOrders.type, serviceType.id), eq(workOrders.type, "PREVENTIVE")),
            like(workOrders.scheduledDate, monthPrefix)
          )
        );

      if (conflicts.length > 0) {
        const codes = [...new Set(conflicts.map((c) => c.internalCode))];
        const preview = codes.slice(0, 4).join(", ");
        const extra = codes.length > 4 ? ` y ${codes.length - 4} más` : "";
        return {
          success: false,
          error: `Mantenimiento preventivo ya programado este mes para: ${preview}${extra}. No se puede registrar otro para el mismo equipo.`,
        };
      }
    }

    const [{ total }] = await db
      .select({ total: count() })
      .from(workOrders)
      .where(like(workOrders.otNumber, `OT-${monthLabel}-%`));
    const otNumber = `OT-${monthLabel}-${String((total ?? 0) + 1).padStart(4, "0")}`;

    const workOrderId = generateUuid();
    const stmts: BatchItem<"sqlite">[] = [
      db.insert(workOrders).values({
        id: workOrderId,
        otNumber,
        costCenterId: validated.costCenterId,
        technicianId: validated.technicianId || null,
        type: serviceType.id,
        status: "PENDING",
        priority: validated.priority || "NORMAL",
        scheduledDate: validated.scheduledDate,
        scheduledTime: validated.scheduledTime || null,
      }),
    ];
    for (const elevatorId of elevatorIds) {
      stmts.push(
        db.insert(workOrderElevators).values({
          id: generateUuid(),
          workOrderId,
          elevatorUnityId: elevatorId,
          status: "PENDING",
        })
      );
    }
    await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);

    revalidatePath("/work-orders");
    return { success: true, message: `OT ${otNumber} creada correctamente` };
  } catch (error) {
    console.error("Error al crear orden de trabajo:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El número de OT ya existe. Intenta nuevamente." };
    }
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateWorkOrder(id: string, data: Partial<WorkOrderFormValues>) {
  try {
    const updateData: {
      costCenterId?: string;
      technicianId?: string | null;
      type?: string;
      priority?: string;
      scheduledDate?: string | null;
      scheduledTime?: string | null;
    } = {};
    if (data.costCenterId) updateData.costCenterId = data.costCenterId;
    if (data.technicianId !== undefined) updateData.technicianId = data.technicianId || null;
    if (data.serviceTypeId) updateData.type = data.serviceTypeId;
    if (data.priority) updateData.priority = data.priority;
    if (data.scheduledDate !== undefined)
      updateData.scheduledDate = data.scheduledDate || null;
    if (data.scheduledTime !== undefined)
      updateData.scheduledTime = data.scheduledTime || null;

    await db.update(workOrders).set(updateData).where(eq(workOrders.id, id));

    revalidatePath("/work-orders");
    return { success: true, message: "Orden de trabajo actualizada" };
  } catch (error) {
    console.error("Error al actualizar orden de trabajo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateWorkOrderStatus(id: string, status: string) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const updateData: { status: string; startedAt?: number; completedAt?: number } = {
      status,
    };
    if (status === "IN_PROGRESS") updateData.startedAt = now;
    if (status === "COMPLETED") updateData.completedAt = now;

    await db.update(workOrders).set(updateData).where(eq(workOrders.id, id));

    revalidatePath("/work-orders");
    return { success: true, message: "Estado de OT actualizado" };
  } catch (error) {
    console.error("Error al actualizar estado de OT:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteWorkOrder(id: string) {
  try {
    await db.update(workOrders).set({ deletedAt: Math.floor(Date.now() / 1000) }).where(eq(workOrders.id, id));
    revalidatePath("/work-orders");
    return { success: true, message: "Orden de trabajo eliminada correctamente" };
  } catch (error) {
    console.error("Error al eliminar orden de trabajo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 2. EQUIPOS ATENDIDOS EN LA OT
// ==========================================

export type WorkOrderElevatorWithRelations = WorkOrderElevator & {
  internal_code?: string | null;
  elevator_name?: string | null;
  cost_center_name?: string | null;
  evidencePhotoUrls?: Array<string> | null;
};

export async function getWorkOrderElevators(
  workOrderId?: string
): Promise<WorkOrderElevatorWithRelations[]> {
  try {
    const query = db
      .select({
        id: workOrderElevators.id,
        workOrderId: workOrderElevators.workOrderId,
        elevatorUnityId: workOrderElevators.elevatorUnityId,
        status: workOrderElevators.status,
        finding: workOrderElevators.finding,
        finalStatus: workOrderElevators.finalStatus,
        completedAt: workOrderElevators.completedAt,
        evidencePhotoUrls: workOrderElevators.evidencePhotoUrls,
        internal_code: elevatorUnities.internalCode,
        elevator_name: elevatorUnities.name,
        cost_center_name: costCenters.name,
      })
      .from(workOrderElevators)
      .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
      .innerJoin(costCenters, eq(elevatorUnities.costCenterId, costCenters.id))
      .orderBy(asc(elevatorUnities.internalCode));

    const rows = await query;
    const mapped = rows.map((row) => ({
      ...row,
      evidencePhotoUrls: (row.evidencePhotoUrls as string[] | null) ?? null,
    }));

    if (workOrderId) {
      return mapped.filter((e) => e.workOrderId === workOrderId);
    }
    return mapped;
  } catch (error) {
    console.error("Error al obtener equipos de la OT:", error);
    return [];
  }
}

export async function createWorkOrderElevator(data: WorkOrderElevatorFormValues) {
  try {
    const validated = workOrderElevatorFormSchema.parse(data);

    await db.insert(workOrderElevators).values({
      id: generateUuid(),
      workOrderId: validated.workOrderId,
      elevatorUnityId: validated.elevatorUnityId,
      status: "PENDING",
      finding: validated.finding?.trim() || null,
    });

    revalidatePath("/work-orders");
    return { success: true, message: "Equipo asignado a la OT" };
  } catch (error) {
    console.error("Error al asignar equipo a la OT:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateWorkOrderElevatorStatus(id: string, status: string) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const updateData: { status: string; completedAt?: number } = { status };
    if (status === "COMPLETED") updateData.completedAt = now;

    await db.update(workOrderElevators).set(updateData).where(eq(workOrderElevators.id, id));

    revalidatePath("/work-orders");
    return { success: true, message: "Estado del equipo actualizado" };
  } catch (error) {
    console.error("Error al actualizar estado del equipo:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateWorkOrderElevatorFinding(id: string, finding: string) {
  try {
    await db
      .update(workOrderElevators)
      .set({ finding: finding.trim() || null })
      .where(eq(workOrderElevators.id, id));

    revalidatePath("/work-orders");
    return { success: true, message: "Hallazgos actualizados" };
  } catch (error) {
    console.error("Error al actualizar hallazgos:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteWorkOrderElevator(id: string) {
  try {
    await db.delete(workOrderElevators).where(eq(workOrderElevators.id, id));
    revalidatePath("/work-orders");
    return { success: true, message: "Equipo eliminado de la OT" };
  } catch (error) {
    console.error("Error al eliminar equipo de la OT:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// ==========================================
// 3. TAREAS / CHECKLISTS POR EQUIPO
// ==========================================

export type WorkOrderTaskWithRelations = WorkOrderTask;

export async function getWorkOrderTasks(
  workOrderElevatorId: string
): Promise<WorkOrderTaskWithRelations[]> {
  try {
    return await db
      .select()
      .from(workOrderTasks)
      .where(eq(workOrderTasks.workOrderElevatorId, workOrderElevatorId))
      .orderBy(asc(workOrderTasks.id));
  } catch (error) {
    console.error("Error al obtener tareas:", error);
    return [];
  }
}

export async function createWorkOrderTask(data: WorkOrderTaskFormValues) {
  try {
    const validated = workOrderTaskFormSchema.parse(data);

    await db.insert(workOrderTasks).values({
      id: generateUuid(),
      workOrderElevatorId: validated.workOrderElevatorId,
      taskDescription: validated.taskDescription.trim(),
      isCritical: validated.isCritical || false,
      isCompleted: false,
      observations: validated.observations?.trim() || null,
    });

    revalidatePath("/work-orders");
    return { success: true, message: "Tarea agregada correctamente" };
  } catch (error) {
    console.error("Error al crear tarea:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function toggleWorkOrderTask(id: string, isCompleted: boolean) {
  try {
    const now = Math.floor(Date.now() / 1000);
    await db
      .update(workOrderTasks)
      .set({ isCompleted, completedAt: isCompleted ? now : null })
      .where(eq(workOrderTasks.id, id));

    revalidatePath("/work-orders");
    return { success: true, message: isCompleted ? "Tarea completada" : "Tarea marcada como pendiente" };
  } catch (error) {
    console.error("Error al actualizar tarea:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function deleteWorkOrderTask(id: string) {
  try {
    await db.delete(workOrderTasks).where(eq(workOrderTasks.id, id));
    revalidatePath("/work-orders");
    return { success: true, message: "Tarea eliminada correctamente" };
  } catch (error) {
    console.error("Error al eliminar tarea:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}