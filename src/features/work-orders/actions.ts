"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  workOrderElevatorSafety,
  workOrderElevatorSafetyItems,
  contractElevatorModuleExecutions,
  componentReplacements,
  reports,
  serviceTypes,
  costCenters,
  clients,
  users,
  staffProfiles,
  elevatorUnities,
  contractElevators,
  maintenanceModules,
  maintenanceTasks,
  safetyTemplates,
  contracts,
  type WorkOrder,
  type WorkOrderElevator,
  type WorkOrderTask,
} from "@/db/index";
import { getErrorMessage, getErrorDetail } from "@/lib/errors";
import { generateUuid } from "@/lib/uuid";
import {
  workOrderFormSchema,
  workOrderElevatorFormSchema,
  workOrderTaskFormSchema,
  type WorkOrderFormValues,
  type WorkOrderElevatorFormValues,
  type WorkOrderTaskFormValues,
} from "./schema";
import { eq, asc, desc, and, isNull, count, inArray, like } from "drizzle-orm";
import { type BatchItem } from "drizzle-orm/batch";
import { getApplicableModules } from "@/features/maintenance/constants";
import {
  checklistQuestion,
  parseChecklistItems,
} from "@/features/safety/checklist-content";

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
  technicians: Array<{ id: string; fullName: string; jobTitle: string | null; providerType: string | null }>;
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
       .select({ id: users.id, fullName: users.fullName, jobTitle: staffProfiles.specialization, providerType: staffProfiles.providerType })
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
         status: workOrders.status,
        priority: workOrders.priority,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        startedAt: workOrders.startedAt,
        completedAt: workOrders.completedAt,
        supportingTechnicians: workOrders.supportingTechnicians,
        estimatedDurationMins: workOrders.estimatedDurationMins,
        estimatedEndAt: workOrders.estimatedEndAt,
        parentWorkOrderId: workOrders.parentWorkOrderId,
        derivationReason: workOrders.derivationReason,
        closeTimeSource: workOrders.closeTimeSource,
        checkinLatitude: workOrders.checkinLatitude,
        checkinLongitude: workOrders.checkinLongitude,
        closingNotes: workOrders.closingNotes,
        description: workOrders.description,
        clientSignatureUrl: workOrders.clientSignatureUrl,
        clientSignerName: workOrders.clientSignerName,
        approvalStatus: workOrders.approvalStatus,
        approvedBy: workOrders.approvedBy,
        approvedAt: workOrders.approvedAt,
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

export type PreventiveElevatorDetail = {
  statements: BatchItem<"sqlite">[];
  errors: string[];
};

/**
 * Prepara (sin ejecutar) las sentencias de tareas preventivas y del checklist
 * de seguridad para un elevador dentro de una OT preventiva. Se comparte entre
 * la creación manual y la generación automática de OTs del mes para que ambas
 * rutas produzcan exactamente el mismo detalle.
 */
export async function buildPreventiveElevatorDetail({
  workOrderElevatorId,
  elevatorUnityId,
  contractElevatorId,
  scheduledDate,
}: {
  workOrderElevatorId: string;
  elevatorUnityId: string | null;
  contractElevatorId: string | null;
  scheduledDate: string;
}): Promise<PreventiveElevatorDetail> {
  const statements: BatchItem<"sqlite">[] = [];
  const errors: string[] = [];

  if (!contractElevatorId) {
    errors.push("El equipo no está vinculado a un contrato activo.");
    return { statements, errors };
  }
  if (!elevatorUnityId) {
    errors.push("Falta el ascensor del elevador.");
    return { statements, errors };
  }

  const [context] = await db
    .select({
      elevatorTypeId: elevatorUnities.elevatorTypeId,
      startDate: contracts.startDate,
      frequencyMonths: contractElevators.frequencyMonths,
    })
    .from(contractElevators)
    .innerJoin(elevatorUnities, eq(contractElevators.elevatorUnityId, elevatorUnities.id))
    .innerJoin(contracts, eq(contractElevators.contractId, contracts.id))
    .where(eq(contractElevators.id, contractElevatorId))
    .limit(1);
  if (!context?.elevatorTypeId) {
    errors.push("No se pudo determinar el tipo de equipo del ascensor.");
    return { statements, errors };
  }

  const [year, month, day] = scheduledDate.split("-").map(Number);
  const startDate = new Date((context.startDate ?? 0) * 1000);
  const scheduled = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  const monthsSinceStart =
    (scheduled.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    scheduled.getUTCMonth() - startDate.getUTCMonth();
  const frequencyMonths = Math.max(1, context.frequencyMonths ?? 1);
  if (monthsSinceStart < 0 || monthsSinceStart % frequencyMonths !== 0) {
    errors.push("Al equipo no le corresponde mantenimiento según la frecuencia del contrato.");
    return { statements, errors };
  }

  const moduleRows = await db
    .select({
      moduleId: maintenanceModules.id,
      monthsOfYear: maintenanceModules.monthsOfYear,
      taskId: maintenanceTasks.id,
      taskDescription: maintenanceTasks.description,
      isCritical: maintenanceTasks.isCritical,
      requiresPhoto: maintenanceTasks.requiresPhoto,
    })
    .from(maintenanceModules)
    .innerJoin(maintenanceTasks, eq(maintenanceTasks.moduleId, maintenanceModules.id))
    .where(
      and(
        eq(maintenanceModules.elevatorTypeId, context.elevatorTypeId),
        eq(maintenanceModules.isActive, true),
        eq(maintenanceTasks.isActive, true)
      )
    );

  if (moduleRows.length === 0) {
    errors.push("No hay módulos aplicables con tareas activas para el tipo de equipo.");
    return { statements, errors };
  }

  // Plantilla de seguridad activa (la más reciente) para el tipo de equipo.
  const [template] = await db
    .select()
    .from(safetyTemplates)
    .where(
      and(
        eq(safetyTemplates.isActive, true),
        eq(safetyTemplates.equipmentTypeId, context.elevatorTypeId)
      )
    )
    .orderBy(desc(safetyTemplates.createdAt))
    .limit(1);
  if (!template) {
    errors.push("No existe un checklist de seguridad activo para el tipo de equipo del ascensor.");
    return { statements, errors };
  }

  const questions = parseChecklistItems(template.content)
    .map(checklistQuestion)
    .filter((question) => question.length > 0);

  // Referencia del calendario: la fecha programada de la OT.
  const currentDate = new Date(
    Date.UTC(year, (month || 1) - 1, Math.min(day || 1, 28))
  );
  const assigned = moduleRows.map((row) => ({
    id: row.moduleId,
    monthsOfYear: row.monthsOfYear,
  }));
  const applicable = getApplicableModules({
    assigned,
    currentDate,
  });
  const applicableIds = new Set(applicable.map((module) => module.id));

  for (const row of moduleRows) {
    if (!applicableIds.has(row.moduleId)) continue;
    statements.push(
      db.insert(workOrderTasks).values({
        id: generateUuid(),
        workOrderElevatorId,
        maintenanceTaskId: row.taskId,
        moduleId: row.moduleId,
        taskDescription: row.taskDescription,
        isCritical: row.isCritical,
        requiresPhoto: row.requiresPhoto,
      })
    );
  }

  const safetyRecordId = generateUuid();
  statements.push(
    db.insert(workOrderElevatorSafety).values({
      id: safetyRecordId,
      workOrderElevatorId,
      templateId: template.id,
      templateVersion: template.version,
      templateSnapshot: template.content,
      status: "PENDING",
    })
  );
  for (let index = 0; index < questions.length; index++) {
    statements.push(
      db.insert(workOrderElevatorSafetyItems).values({
        id: generateUuid(),
        safetyRecordId,
        question: questions[index],
        orderIndex: index,
      })
    );
  }

  return { statements, errors };
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
      .select({ id: serviceTypes.id, code: serviceTypes.code, name: serviceTypes.name, category: serviceTypes.category })
      .from(serviceTypes)
      .where(eq(serviceTypes.id, validated.serviceTypeId))
      .limit(1);
    const serviceType = serviceTypeRows[0];
    if (!serviceType) {
      return { success: false, error: "Selecciona un tipo de servicio válido." };
    }
    const requiresDescription = serviceType.code !== "PREV" &&
      (serviceType.category === "MANTENIMIENTO" || serviceType.category === "EMERGENCIA");
    if (requiresDescription && (validated.description?.trim().length ?? 0) < 10) {
      return { success: false, error: "La descripción es obligatoria y debe tener mínimo 10 caracteres." };
    }

    const elevatorIds = validated.elevatorUnityIds ?? [];

    const selectedTypes = await db.select({ typeId: elevatorUnities.elevatorTypeId })
      .from(elevatorUnities)
      .where(inArray(elevatorUnities.id, elevatorIds));
    const typeIds = [...new Set(selectedTypes.map((row) => row.typeId))];
    const templates = typeIds.length > 0
      ? await db.select({ equipmentTypeId: safetyTemplates.equipmentTypeId })
        .from(safetyTemplates)
        .where(and(eq(safetyTemplates.isActive, true), inArray(safetyTemplates.equipmentTypeId, typeIds)))
      : [];
    const templatedTypes = new Set(templates.map((row) => row.equipmentTypeId));
    if (typeIds.some((typeId) => !templatedTypes.has(typeId))) {
      return { success: false, error: "Cada equipo debe tener un template de seguridad activo antes de crear la OT." };
    }

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
            eq(workOrders.serviceTypeId, serviceType.id),
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
    const contractElevatorRows = serviceType.code === "PREV"
      ? await db.select({ id: contractElevators.id, elevatorUnityId: contractElevators.elevatorUnityId })
        .from(contractElevators)
        .innerJoin(contracts, eq(contractElevators.contractId, contracts.id))
        .where(and(inArray(contractElevators.elevatorUnityId, elevatorIds), eq(contracts.costCenterId, validated.costCenterId)))
      : [];
    if (serviceType.code === "PREV" && contractElevatorRows.length !== elevatorIds.length) {
      return { success: false, error: "Cada equipo preventivo debe estar vinculado a un contrato activo." };
    }
    const contractElevatorByUnity = new Map(contractElevatorRows.map((row) => [row.elevatorUnityId, row.id]));
    const stmts: BatchItem<"sqlite">[] = [
      db.insert(workOrders).values({
        id: workOrderId,
        otNumber,
        costCenterId: validated.costCenterId,
        technicianId: validated.technicianId || null,
        serviceTypeId: serviceType.id,
        status: "PENDING",
        priority: validated.priority || "NORMAL",
        scheduledDate: validated.scheduledDate,
        scheduledTime: validated.scheduledTime || null,
        description: validated.description?.trim() || null,
        supportingTechnicians: validated.supportingTechnicians?.trim() || null,
        estimatedDurationMins: validated.estimatedDurationMins ?? null,
        estimatedEndAt: validated.estimatedDurationMins && validated.scheduledTime
          ? Math.floor(new Date(`${validated.scheduledDate}T${validated.scheduledTime}`).getTime() / 1000) + validated.estimatedDurationMins * 60
          : null,
      }),
    ];
    const workOrderElevatorRows: Array<{
      id: string;
      elevatorUnityId: string;
    }> = [];
    for (const elevatorId of elevatorIds) {
      const workOrderElevatorId = generateUuid();
      workOrderElevatorRows.push({ id: workOrderElevatorId, elevatorUnityId: elevatorId });
      stmts.push(
        db.insert(workOrderElevators).values({
          id: workOrderElevatorId,
          workOrderId,
          elevatorUnityId: elevatorId,
          contractElevatorId: contractElevatorByUnity.get(elevatorId) ?? null,
          status: "PENDING",
        })
      );
    }

    if (serviceType.code === "PREV") {
      for (const elevator of workOrderElevatorRows) {
        const detail = await buildPreventiveElevatorDetail({
          workOrderElevatorId: elevator.id,
          elevatorUnityId: elevator.elevatorUnityId,
          contractElevatorId: contractElevatorByUnity.get(elevator.elevatorUnityId) ?? null,
          scheduledDate: validated.scheduledDate,
        });
        if (detail.errors.length > 0) {
          return { success: false, error: detail.errors[0] };
        }
        stmts.push(...detail.statements);
      }
    }
    await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]);

    revalidatePath("/work-orders");
    return { success: true, message: `OT ${otNumber} creada correctamente` };
  } catch (error) {
    console.error("Error al crear orden de trabajo:", error);
    if (getErrorMessage(error).includes("UNIQUE constraint failed")) {
      return { success: false, error: "El número de OT ya existe. Intenta nuevamente." };
    }
    console.error("Detalle de creación de OT:", getErrorDetail(error));
    return { success: false, error: `${getErrorMessage(error)}${error instanceof Error ? ` Detalle: ${error.message}` : ""}` };
  }
}

export async function updateWorkOrder(id: string, data: Partial<WorkOrderFormValues>) {
  try {
    const [currentApproval] = await db
      .select({ approvalStatus: workOrders.approvalStatus })
      .from(workOrders)
      .where(eq(workOrders.id, id))
      .limit(1);
    if (currentApproval?.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    const updateData: {
      costCenterId?: string;
      technicianId?: string | null;
      priority?: string;
      scheduledDate?: string | null;
      scheduledTime?: string | null;
      description?: string | null;
      supportingTechnicians?: string | null;
      estimatedDurationMins?: number | null;
      estimatedEndAt?: number | null;
    } = {};
    if (data.costCenterId) updateData.costCenterId = data.costCenterId;
    if (data.technicianId !== undefined) updateData.technicianId = data.technicianId || null;
    if (data.priority) updateData.priority = data.priority;
    if (data.scheduledDate !== undefined)
      updateData.scheduledDate = data.scheduledDate || null;
    if (data.scheduledTime !== undefined)
      updateData.scheduledTime = data.scheduledTime || null;
    if (data.description !== undefined)
      updateData.description = data.description?.trim() || null;
    if (data.supportingTechnicians !== undefined) updateData.supportingTechnicians = data.supportingTechnicians?.trim() || null;
    if (data.estimatedDurationMins !== undefined) updateData.estimatedDurationMins = data.estimatedDurationMins ?? null;

    if (data.estimatedDurationMins !== undefined || data.scheduledDate !== undefined || data.scheduledTime !== undefined) {
      const current = await db.select({
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        estimatedDurationMins: workOrders.estimatedDurationMins,
      }).from(workOrders).where(eq(workOrders.id, id)).limit(1);
      const row = current[0];
      const date = data.scheduledDate ?? row?.scheduledDate;
      const time = data.scheduledTime ?? row?.scheduledTime;
      const duration = data.estimatedDurationMins ?? row?.estimatedDurationMins;
      const equipment = await db.select({ id: workOrderElevators.id }).from(workOrderElevators).where(eq(workOrderElevators.workOrderId, id));
      updateData.estimatedEndAt = date && time && duration
        ? Math.floor(new Date(`${date}T${time}`).getTime() / 1000) + duration * equipment.length * 60
        : null;
    }

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
    const [currentApproval] = await db
      .select({ approvalStatus: workOrders.approvalStatus })
      .from(workOrders)
      .where(eq(workOrders.id, id))
      .limit(1);
    if (currentApproval?.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
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
    const [workOrder] = await db
      .select({ status: workOrders.status, approvalStatus: workOrders.approvalStatus })
      .from(workOrders)
      .where(eq(workOrders.id, id))
      .limit(1);
    if (!workOrder) return { success: false, error: "La orden de trabajo no existe." };
    if (workOrder.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    if (workOrder.status !== "PENDING") {
      return {
        success: false,
        error: "Solo se puede eliminar una OT pendiente. Reanudar y completarla, o cerrarla primero.",
      };
    }

    // Hay tablas que referencian a la OT con eliminación restringida: no se
    // borran datos relacionados (ejecuciones, repuestos, reportes).
    const [executionCount, replacementCount, reportCount] = await Promise.all([
      db
        .select({ n: count() })
        .from(contractElevatorModuleExecutions)
        .where(eq(contractElevatorModuleExecutions.workOrderId, id)),
      db
        .select({ n: count() })
        .from(componentReplacements)
        .where(eq(componentReplacements.workOrderId, id)),
      db
        .select({ n: count() })
        .from(reports)
        .where(eq(reports.workOrderId, id)),
    ]);
    if (executionCount[0]?.n || replacementCount[0]?.n || reportCount[0]?.n) {
      return {
        success: false,
        error: "Esta OT tiene ejecuciones de módulos, repuestos o reportes asociados. Elimine primero esos registros.",
      };
    }

    await db.transaction(async (tx) => {
      // Borrado explícito por orden de dependencias (idempotente aunque el
      // enforcement de claves foráneas esté desactivado).
      const elevatorRows = await tx
        .select({ id: workOrderElevators.id })
        .from(workOrderElevators)
        .where(eq(workOrderElevators.workOrderId, id));
      const elevatorIds = elevatorRows.map((row) => row.id);

      if (elevatorIds.length > 0) {
        const safetyRows = await tx
          .select({ id: workOrderElevatorSafety.id })
          .from(workOrderElevatorSafety)
          .where(inArray(workOrderElevatorSafety.workOrderElevatorId, elevatorIds));
        const safetyIds = safetyRows.map((row) => row.id);

        if (safetyIds.length > 0) {
          await tx
            .delete(workOrderElevatorSafetyItems)
            .where(inArray(workOrderElevatorSafetyItems.safetyRecordId, safetyIds));
        }
        await tx
          .delete(workOrderElevatorSafety)
          .where(inArray(workOrderElevatorSafety.workOrderElevatorId, elevatorIds));
        await tx
          .delete(workOrderTasks)
          .where(inArray(workOrderTasks.workOrderElevatorId, elevatorIds));
        await tx
          .delete(workOrderElevators)
          .where(inArray(workOrderElevators.workOrderId, [id]));
      }

      await tx.delete(workOrders).where(eq(workOrders.id, id));
    });

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
        contractElevatorId: workOrderElevators.contractElevatorId,
        status: workOrderElevators.status,
        finding: workOrderElevators.finding,
        finalStatus: workOrderElevators.finalStatus,
        startedAt: workOrderElevators.startedAt,
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
    const [approval] = await db
      .select({ approvalStatus: workOrders.approvalStatus })
      .from(workOrders)
      .where(eq(workOrders.id, validated.workOrderId))
      .limit(1);
    if (approval?.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }

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
    const [approval] = await db
      .select({ approvalStatus: workOrders.approvalStatus })
      .from(workOrderElevators)
      .innerJoin(workOrders, eq(workOrderElevators.workOrderId, workOrders.id))
      .where(eq(workOrderElevators.id, id))
      .limit(1);
    if (approval?.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    // Los tiempos reales por equipo se registran en milisegundos (app del técnico).
    const now = Date.now();
    const updateData: { status: string; startedAt?: number; completedAt?: number } = { status };
    if (status === "IN_PROGRESS") updateData.startedAt = now;
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
    const [approval] = await db
      .select({ approvalStatus: workOrders.approvalStatus })
      .from(workOrderElevators)
      .innerJoin(workOrders, eq(workOrderElevators.workOrderId, workOrders.id))
      .where(eq(workOrderElevators.id, id))
      .limit(1);
    if (approval?.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
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
    const [approval] = await db
      .select({ approvalStatus: workOrders.approvalStatus })
      .from(workOrderElevators)
      .innerJoin(workOrders, eq(workOrderElevators.workOrderId, workOrders.id))
      .where(eq(workOrderElevators.id, id))
      .limit(1);
    if (approval?.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
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

export type WorkOrderTaskWithRelations = WorkOrderTask & {
  module_code?: string | null;
  module_name?: string | null;
};

export async function getWorkOrderTasks(
  workOrderElevatorId: string
): Promise<WorkOrderTaskWithRelations[]> {
  try {
    return await db
      .select({
        id: workOrderTasks.id,
        workOrderElevatorId: workOrderTasks.workOrderElevatorId,
        taskDescription: workOrderTasks.taskDescription,
        maintenanceTaskId: workOrderTasks.maintenanceTaskId,
        moduleId: workOrderTasks.moduleId,
        isCritical: workOrderTasks.isCritical,
        isCompleted: workOrderTasks.isCompleted,
        status: workOrderTasks.status,
        requiresPhoto: workOrderTasks.requiresPhoto,
        observations: workOrderTasks.observations,
        evidencePhotoUrl: workOrderTasks.evidencePhotoUrl,
        completedAt: workOrderTasks.completedAt,
        module_code: maintenanceModules.code,
        module_name: maintenanceModules.name,
      })
      .from(workOrderTasks)
      .leftJoin(
        maintenanceModules,
        eq(workOrderTasks.moduleId, maintenanceModules.id)
      )
      .where(eq(workOrderTasks.workOrderElevatorId, workOrderElevatorId))
      .orderBy(asc(maintenanceModules.code), asc(workOrderTasks.id));
  } catch (error) {
    console.error("Error al obtener tareas:", error);
    return [];
  }
}

export async function createWorkOrderTask(data: WorkOrderTaskFormValues) {
  try {
    const validated = workOrderTaskFormSchema.parse(data);
    const [approval] = await db
      .select({ approvalStatus: workOrders.approvalStatus })
      .from(workOrderElevators)
      .innerJoin(workOrders, eq(workOrderElevators.workOrderId, workOrders.id))
      .where(eq(workOrderElevators.id, validated.workOrderElevatorId))
      .limit(1);
    if (approval?.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }

    await db.insert(workOrderTasks).values({
      id: generateUuid(),
      workOrderElevatorId: validated.workOrderElevatorId,
      taskDescription: validated.taskDescription.trim(),
      isCritical: validated.isCritical || false,
      isCompleted: false,
      observations: validated.observations?.trim() || null,
      requiresPhoto: validated.requiresPhoto || false,
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
    const [approval] = await db
      .select({ approvalStatus: workOrders.approvalStatus })
      .from(workOrderTasks)
      .innerJoin(workOrderElevators, eq(workOrderTasks.workOrderElevatorId, workOrderElevators.id))
      .innerJoin(workOrders, eq(workOrderElevators.workOrderId, workOrders.id))
      .where(eq(workOrderTasks.id, id))
      .limit(1);
    if (approval?.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
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
    const [approval] = await db
      .select({ approvalStatus: workOrders.approvalStatus })
      .from(workOrderTasks)
      .innerJoin(workOrderElevators, eq(workOrderTasks.workOrderElevatorId, workOrderElevators.id))
      .innerJoin(workOrders, eq(workOrderElevators.workOrderId, workOrders.id))
      .where(eq(workOrderTasks.id, id))
      .limit(1);
    if (approval?.approvalStatus === "APPROVED") {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    await db.delete(workOrderTasks).where(eq(workOrderTasks.id, id));
    revalidatePath("/work-orders");
    return { success: true, message: "Tarea eliminada correctamente" };
  } catch (error) {
    console.error("Error al eliminar tarea:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
