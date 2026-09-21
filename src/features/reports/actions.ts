"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  costCenters,
  clients,
  users,
  elevatorUnities,
  serviceTypes,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { buildEvidenceKey, uploadToR2 } from "@/lib/r2";
import { eq, asc, desc, and, isNull } from "drizzle-orm";

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

export async function getCompletedWorkOrders(): Promise<CompletedWorkOrderReport[]> {
  try {
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
        type: workOrders.type,
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
      })
      .from(workOrders)
      .innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id))
      .innerJoin(clients, eq(costCenters.clientId, clients.id))
      .leftJoin(users, eq(workOrders.technicianId, users.id))
      .leftJoin(serviceTypes, eq(workOrders.type, serviceTypes.id))
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
      })
      .from(workOrderTasks)
      .orderBy(asc(workOrderTasks.id));

    const tasksByElevator = new Map<string, ReportElevatorTask[]>();
    for (const task of taskRows) {
      const list = tasksByElevator.get(task.workOrderElevatorId) ?? [];
      list.push({
        id: task.id,
        taskDescription: task.taskDescription,
        isCritical: !!task.isCritical,
        isCompleted: !!task.isCompleted,
        observations: task.observations,
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

    const existing = await db
      .select({ evidencePhotoUrls: workOrderElevators.evidencePhotoUrls })
      .from(workOrderElevators)
      .where(eq(workOrderElevators.id, elevatorId))
      .limit(1);
    const urls: string[] = (
      (existing[0]?.evidencePhotoUrls as string[] | null) ?? []
    ).filter((u): u is string => typeof u === "string" && u.length > 0);

    const remaining = MAX_EVIDENCE_PER_ELEVATOR - urls.length;
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
      const key = buildEvidenceKey(workOrderId, elevatorId, urls.length + i + 1, ext);
      const url = await uploadToR2(
        key,
        bytes,
        ext === "png" ? "image/png" : "image/jpeg"
      );
      uploadedUrls.push(url);
    }

    await db
      .update(workOrderElevators)
      .set({ evidencePhotoUrls: [...urls, ...uploadedUrls] })
      .where(eq(workOrderElevators.id, elevatorId));

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
    const existing = await db
      .select({ evidencePhotoUrls: workOrderElevators.evidencePhotoUrls })
      .from(workOrderElevators)
      .where(eq(workOrderElevators.id, elevatorId))
      .limit(1);
    const urls: string[] = (
      (existing[0]?.evidencePhotoUrls as string[] | null) ?? []
    ).filter((u): u is string => typeof u === "string" && u !== url);

    await db
      .update(workOrderElevators)
      .set({ evidencePhotoUrls: urls })
      .where(eq(workOrderElevators.id, elevatorId));

    revalidatePath("/reports");
    return { success: true, message: "Foto eliminada de las evidencias.", urls };
  } catch (error) {
    console.error("Error al eliminar evidencia:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}