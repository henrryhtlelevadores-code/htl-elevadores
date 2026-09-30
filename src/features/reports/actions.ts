"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  workOrderElevatorPhotos,
  maintenanceModules,
  costCenters,
  clients,
  users,
  elevatorUnities,
  serviceTypes,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { buildEvidenceKey, uploadToR2 } from "@/lib/r2";
import { generateUuid } from "@/lib/uuid";
import { eq, asc, desc, and, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";

const MAX_EVIDENCE_PER_ELEVATOR = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const LEGACY_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: "Correctivo",
  PREVENTIVE: "Preventivo",
  PREDICTIVE: "Predictivo",
  INSTALLATION: "Instalación",
};

export type ReportElevatorTask = {
  id: string;
  taskDescription: string;
  isCritical: boolean;
  isCompleted: boolean;
  observations: string | null;
  moduleId: string | null;
  moduleCode: string | null;
  moduleName: string | null;
};

export type ReportPhoto = {
  id: string;
  url: string;
  tag: string;
  description: string | null;
  createdAt: number | null;
};

export type ReportElevator = {
  id: string;
  workOrderId: string;
  elevatorUnityId: string;
  internalCode: string | null;
  elevatorName: string | null;
  status: string | null;
  finalStatus: string | null;
  finding: string | null;
  evidencePhotoUrls: string[];
  photos: ReportPhoto[];
  completedAt: number | null;
  tasks: ReportElevatorTask[];
};

export type CompletedWorkOrderReport = {
  id: string;
  otNumber: string;
  clientId: string | null;
  client_name: string;
  costCenterId: string | null;
  cost_center_name: string;
  technicianId: string | null;
  technician_name: string | null;
  serviceTypeName: string | null;
  status: string | null;
  priority: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  startedAt: number | null;
  completedAt: number | null;
  closingNotes: string | null;
  clientSignatureUrl: string | null;
  clientSignerName: string | null;
  createdAt: number | null;
  elevators: ReportElevator[];
  approvalStatus: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: number | null;
};

export interface ActionResult {
  success: boolean;
  message?: string;
  error?: string;
  urls?: string[];
}

function decodeDataUrl(dataUrl: string): Uint8Array {
  const raw = dataUrl.split(",")[1] ?? dataUrl;
  if (!raw) throw new Error("Formato de imagen inválido");
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error("La imagen supera el tamaño máximo de 5 MB");
  }
  return bytes;
}

async function isWorkOrderEditable(workOrderId: string): Promise<boolean> {
  const [row] = await db
    .select({ approvalStatus: workOrders.approvalStatus })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);
  return row?.approvalStatus !== "APPROVED";
}

export async function getCompletedWorkOrders(): Promise<CompletedWorkOrderReport[]> {
  try {
    const approvedUsers = alias(users, "approved_users");
    const woRows = await db
      .select({
        id: workOrders.id,
        otNumber: workOrders.otNumber,
        clientId: costCenters.clientId,
        client_name: clients.legalName,
        costCenterId: workOrders.costCenterId,
        cost_center_name: costCenters.name,
        technicianId: workOrders.technicianId,
        technician_name: users.fullName,
        serviceTypeName: serviceTypes.name,
        type: workOrders.serviceTypeId,
        status: workOrders.status,
        priority: workOrders.priority,
        scheduledDate: workOrders.scheduledDate,
        scheduledTime: workOrders.scheduledTime,
        startedAt: workOrders.startedAt,
        completedAt: workOrders.completedAt,
        closingNotes: workOrders.closingNotes,
        clientSignatureUrl: workOrders.clientSignatureUrl,
        clientSignerName: workOrders.clientSignerName,
        createdAt: workOrders.createdAt,
        approvalStatus: workOrders.approvalStatus,
        approvedBy: workOrders.approvedBy,
        approvedByName: approvedUsers.fullName,
        approvedAt: workOrders.approvedAt,
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .leftJoin(users, eq(workOrders.technicianId, users.id))
      .leftJoin(approvedUsers, eq(workOrders.approvedBy, approvedUsers.id))
      .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .where(and(eq(workOrders.status, "COMPLETED"), isNull(workOrders.deletedAt)))
      .orderBy(desc(workOrders.completedAt));

    const elevatorRows = await db
      .select({
        id: workOrderElevators.id,
        workOrderId: workOrderElevators.workOrderId,
        elevatorUnityId: workOrderElevators.elevatorUnityId,
        status: workOrderElevators.status,
        finalStatus: workOrderElevators.finalStatus,
        finding: workOrderElevators.finding,
        evidencePhotoUrls: workOrderElevators.evidencePhotoUrls,
        completedAt: workOrderElevators.completedAt,
        internalCode: elevatorUnities.internalCode,
        elevatorName: elevatorUnities.name,
      })
      .from(workOrderElevators)
      .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
      .orderBy(asc(elevatorUnities.internalCode));

    const taskRows = await db
      .select({
        id: workOrderTasks.id,
        workOrderElevatorId: workOrderTasks.workOrderElevatorId,
        taskDescription: workOrderTasks.taskDescription,
        isCritical: workOrderTasks.isCritical,
        isCompleted: workOrderTasks.isCompleted,
        observations: workOrderTasks.observations,
        moduleId: workOrderTasks.moduleId,
        moduleCode: maintenanceModules.code,
        moduleName: maintenanceModules.name,
      })
      .from(workOrderTasks)
      .leftJoin(maintenanceModules, eq(workOrderTasks.moduleId, maintenanceModules.id))
      .orderBy(asc(workOrderTasks.id));

    const photoRows = await db
      .select({
        id: workOrderElevatorPhotos.id,
        workOrderElevatorId: workOrderElevatorPhotos.workOrderElevatorId,
        url: workOrderElevatorPhotos.url,
        tag: workOrderElevatorPhotos.tag,
        description: workOrderElevatorPhotos.description,
        createdAt: workOrderElevatorPhotos.createdAt,
      })
      .from(workOrderElevatorPhotos)
      .orderBy(asc(workOrderElevatorPhotos.createdAt));

    const photosByElevator = new Map<string, ReportPhoto[]>();
    for (const photo of photoRows) {
      const list = photosByElevator.get(photo.workOrderElevatorId) ?? [];
      list.push({
        id: photo.id,
        url: photo.url,
        tag: photo.tag,
        description: photo.description,
        createdAt: photo.createdAt,
      });
      photosByElevator.set(photo.workOrderElevatorId, list);
    }

    const tasksByElevator = new Map<string, ReportElevatorTask[]>();
    for (const task of taskRows) {
      const list = tasksByElevator.get(task.workOrderElevatorId) ?? [];
      list.push({
        id: task.id,
        taskDescription: task.taskDescription,
        isCritical: !!task.isCritical,
        isCompleted: !!task.isCompleted,
        observations: task.observations,
        moduleId: task.moduleId,
        moduleCode: task.moduleCode,
        moduleName: task.moduleName,
      });
      tasksByElevator.set(task.workOrderElevatorId, list);
    }

    const elevatorsByWorkOrder = new Map<string, ReportElevator[]>();
    for (const e of elevatorRows) {
      const elevator: ReportElevator = {
        id: e.id,
        workOrderId: e.workOrderId,
        elevatorUnityId: e.elevatorUnityId,
        internalCode: e.internalCode,
        elevatorName: e.elevatorName,
        status: e.status,
        finalStatus: e.finalStatus,
        finding: e.finding,
        evidencePhotoUrls: (e.evidencePhotoUrls as string[] | null) ?? [],
        photos: photosByElevator.get(e.id) ?? [],
        completedAt: e.completedAt,
        tasks: tasksByElevator.get(e.id) ?? [],
      };
      const list = elevatorsByWorkOrder.get(e.workOrderId) ?? [];
      list.push(elevator);
      elevatorsByWorkOrder.set(e.workOrderId, list);
    }

    return woRows.map((row) => ({
      id: row.id,
      otNumber: row.otNumber,
      clientId: row.clientId,
      client_name: row.client_name,
      costCenterId: row.costCenterId,
      cost_center_name: row.cost_center_name,
      technicianId: row.technicianId,
      technician_name: row.technician_name,
      serviceTypeName:
        row.serviceTypeName ?? LEGACY_TYPE_LABELS[row.type ?? ""] ?? row.type ?? "—",
      status: row.status,
      priority: row.priority,
      scheduledDate: row.scheduledDate,
      scheduledTime: row.scheduledTime,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      closingNotes: row.closingNotes,
      clientSignatureUrl: row.clientSignatureUrl,
      clientSignerName: row.clientSignerName,
      createdAt: row.createdAt,
      elevators: elevatorsByWorkOrder.get(row.id) ?? [],
      approvalStatus: row.approvalStatus ?? "PENDING",
      approvedBy: row.approvedBy,
      approvedByName: row.approvedByName,
      approvedAt: row.approvedAt,
    }));
  } catch (error) {
    console.error("Error al obtener órdenes completadas:", error);
    return [];
  }
}

export interface ReportsFilterData {
  clients: Array<{ id: string; legalName: string }>;
  costCenters: Array<{
    id: string;
    name: string;
    clientId: string;
    client_name: string;
  }>;
}

export async function getReportsFilterData(): Promise<ReportsFilterData> {
  const [clientRes, ccRes] = await Promise.all([
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
  ]);

  return { clients: clientRes, costCenters: ccRes };
}

export async function updateElevatorFinding(
  elevatorId: string,
  finding: string
): Promise<ActionResult> {
  try {
    const [elevator] = await db
      .select({ workOrderId: workOrderElevators.workOrderId })
      .from(workOrderElevators)
      .where(eq(workOrderElevators.id, elevatorId))
      .limit(1);
    if (!elevator || !(await isWorkOrderEditable(elevator.workOrderId))) {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    await db
      .update(workOrderElevators)
      .set({ finding: finding.trim().slice(0, 2000) || null })
      .where(eq(workOrderElevators.id, elevatorId));

    revalidatePath("/reports");
    return { success: true, message: "Hallazgos actualizados." };
  } catch (error) {
    console.error("Error al actualizar hallazgos:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateWorkOrderClosingNotes(
  workOrderId: string,
  closingNotes: string
): Promise<ActionResult> {
  try {
    if (!(await isWorkOrderEditable(workOrderId))) {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    await db
      .update(workOrders)
      .set({ closingNotes: closingNotes.trim().slice(0, 2000) || null })
      .where(eq(workOrders.id, workOrderId));

    revalidatePath("/reports");
    return { success: true, message: "Notas de cierre actualizadas." };
  } catch (error) {
    console.error("Error al actualizar notas de cierre:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateTaskObservation(
  taskId: string,
  observations: string
): Promise<ActionResult> {
  try {
    const [task] = await db
      .select({ workOrderId: workOrderElevators.workOrderId })
      .from(workOrderTasks)
      .innerJoin(workOrderElevators, eq(workOrderTasks.workOrderElevatorId, workOrderElevators.id))
      .where(eq(workOrderTasks.id, taskId))
      .limit(1);
    if (!task || !(await isWorkOrderEditable(task.workOrderId))) {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    await db
      .update(workOrderTasks)
      .set({ observations: observations.trim().slice(0, 500) || null })
      .where(eq(workOrderTasks.id, taskId));

    revalidatePath("/reports");
    return { success: true, message: "Observación de la tarea actualizada." };
  } catch (error) {
    console.error("Error al actualizar observación de tarea:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function addEvidencePhotos(
  workOrderId: string,
  elevatorId: string,
  images: Array<{ dataUrl: string; contentType: string }>
): Promise<ActionResult> {
  try {
    if (!images || images.length === 0) {
      return { success: false, error: "No se recibieron imágenes." };
    }
    const [elevator] = await db
      .select({ workOrderId: workOrderElevators.workOrderId })
      .from(workOrderElevators)
      .where(eq(workOrderElevators.id, elevatorId))
      .limit(1);
    if (!elevator || !(await isWorkOrderEditable(elevator.workOrderId))) {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }

    const existing = await db
      .select({ id: workOrderElevatorPhotos.id })
      .from(workOrderElevatorPhotos)
      .where(eq(workOrderElevatorPhotos.workOrderElevatorId, elevatorId));
    const remaining = MAX_EVIDENCE_PER_ELEVATOR - existing.length;
    if (remaining <= 0) {
      return {
        success: false,
        error: `Límite de ${MAX_EVIDENCE_PER_ELEVATOR} fotos por equipo alcanzado.`,
      };
    }

    const uploads = images.slice(0, remaining);
    const uploadedUrls: string[] = [];
    for (let i = 0; i < uploads.length; i++) {
      const { dataUrl, contentType } = uploads[i];
      const ext = contentType === "image/png" ? "png" : "jpg";
      const bytes = decodeDataUrl(dataUrl);
      const key = buildEvidenceKey(workOrderId, elevatorId, existing.length + i + 1, ext);
      const url = await uploadToR2(
        key,
        bytes,
        ext === "png" ? "image/png" : "image/jpeg"
      );
      uploadedUrls.push(url);
      await db.insert(workOrderElevatorPhotos).values({
        id: generateUuid(),
        workOrderElevatorId: elevatorId,
        url,
        tag: "POINT",
      });
    }

    revalidatePath("/reports");
    return {
      success: true,
      message: `${uploadedUrls.length} foto(s) agregada(s).`,
      urls: uploadedUrls,
    };
  } catch (error) {
    console.error("Error al agregar evidencias:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function removeEvidencePhoto(
  elevatorId: string,
  url: string
): Promise<ActionResult> {
  try {
    const [elevator] = await db
      .select({ workOrderId: workOrderElevators.workOrderId })
      .from(workOrderElevators)
      .where(eq(workOrderElevators.id, elevatorId))
      .limit(1);
    if (!elevator || !(await isWorkOrderEditable(elevator.workOrderId))) {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    await db
      .delete(workOrderElevatorPhotos)
      .where(
        and(
          eq(workOrderElevatorPhotos.workOrderElevatorId, elevatorId),
          eq(workOrderElevatorPhotos.url, url)
        )
      );

    revalidatePath("/reports");
    return { success: true, message: "Foto eliminada de las evidencias." };
  } catch (error) {
    console.error("Error al eliminar evidencia:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
