"use server";

import { revalidatePath } from "next/cache";
import {
  db,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  workOrderElevatorPhotos,
  workOrderElevatorAudios,
  maintenanceModules,
  costCenters,
  clients,
  users,
  elevatorUnities,
  serviceTypes,
} from "@/db/index";
import { getErrorMessage } from "@/lib/errors";
import { denyUnless, requirePermission } from "@/features/auth/guard";
import { buildEvidenceKey, getSignedPrivateUrl, isPrivatePdfStorageConfigured, uploadToR2 } from "@/lib/r2";
import { generateUuid } from "@/lib/uuid";
import { transcribeStoredAudio } from "@/features/audios/transcribe";
import { eq, asc, desc, and, isNull, inArray } from "drizzle-orm";
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

/** Nota de voz grabada desde la app; `url` es firmada y dura una hora. */
export type ReportAudio = {
  id: string;
  url: string | null;
  durationMs: number;
  transcript: string | null;
  transcriptStatus: string;
  createdAt: number;
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
  audios: ReportAudio[];
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

export type ManualReportOrder = { id: string; otNumber: string; clientId: string; clientName: string; costCenterId: string; costCenterName: string; serviceTypeId: string | null; serviceTypeName: string | null; scheduledDate: string | null; scheduledTime: string | null; description: string | null; elevators: Array<{ id: string; name: string | null; internalCode: string | null }> };

export async function getPendingManualReportOrders(): Promise<ManualReportOrder[]> {
  await requirePermission("reports:read");
  const rows = await db.select({ id: workOrders.id, otNumber: workOrders.otNumber, clientId: clients.id, clientName: clients.legalName, costCenterId: workOrders.costCenterId, costCenterName: costCenters.name, serviceTypeId: workOrders.serviceTypeId, serviceTypeName: serviceTypes.name, scheduledDate: workOrders.scheduledDate, scheduledTime: workOrders.scheduledTime, description: workOrders.description })
    .from(workOrders).innerJoin(costCenters, eq(workOrders.costCenterId, costCenters.id)).innerJoin(clients, eq(costCenters.clientId, clients.id)).leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .where(and(eq(workOrders.status, "PENDING"), isNull(workOrders.deletedAt))).orderBy(desc(workOrders.createdAt));
  const elevators = await db.select({ id: workOrderElevators.id, workOrderId: workOrderElevators.workOrderId, name: elevatorUnities.name, internalCode: elevatorUnities.internalCode }).from(workOrderElevators).innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id));
  const byOrder = new Map<string, ManualReportOrder["elevators"]>(); for (const e of elevators) { const list = byOrder.get(e.workOrderId) ?? []; list.push({ id: e.id, name: e.name, internalCode: e.internalCode }); byOrder.set(e.workOrderId, list); }
  return rows.map((r) => ({ ...r, elevators: byOrder.get(r.id) ?? [] }));
}

function peruTimestamp(date: string | null, time: string): number | null {
  if (!date || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = Date.parse(`${date}T${time}:00-05:00`);
  return Number.isNaN(value) ? null : value;
}

export async function completeManualReport(data: { workOrderId: string; date: string | null; startTime: string; endTime: string; number: string; notes: string; findings: Record<string, string>; signerName: string; signatureDataUrl: string }): Promise<ActionResult> {
  const denied = await denyUnless("reports:write");
  if (denied) return denied;
  try {
    const startedAt = peruTimestamp(data.date, data.startTime);
    const completedAt = peruTimestamp(data.date, data.endTime);
    if (!data.workOrderId || !data.signatureDataUrl || !data.signerName.trim() || !startedAt || !completedAt) return { success: false, error: "Horas, nombre del firmante y firma son obligatorios." };
    if (completedAt <= startedAt) return { success: false, error: "La hora de fin debe ser posterior a la hora de inicio." };
    const row = await db.select({ status: workOrders.status }).from(workOrders).where(eq(workOrders.id, data.workOrderId)).limit(1);
    if (row[0]?.status !== "PENDING") return { success: false, error: "La OT ya no está pendiente." };
    const signatureUrl = await uploadToR2(buildEvidenceKey(data.workOrderId, "manual", 1, "png"), decodeDataUrl(data.signatureDataUrl), "image/png");
    const now = Date.now();
    await db.update(workOrders).set({ status: "COMPLETED", completedAt, startedAt, closingNotes: data.notes.trim() || null, clientSignatureUrl: signatureUrl, clientSignerName: data.signerName.trim(), filledByAdmin: true, manualReportNumber: data.number.trim().slice(0, 100), approvalStatus: "PENDING", approvedBy: null, approvedAt: null }).where(eq(workOrders.id, data.workOrderId));
    const es = await db.select({ id: workOrderElevators.id }).from(workOrderElevators).where(eq(workOrderElevators.workOrderId, data.workOrderId));
    if (es.length) { await db.update(workOrderElevators).set({ status: "COMPLETED", finalStatus: "OPERATIVE", completedAt }).where(inArray(workOrderElevators.id, es.map((e) => e.id))); await db.update(workOrderTasks).set({ isCompleted: true, status: "COMPLETED", completedAt }).where(inArray(workOrderTasks.workOrderElevatorId, es.map((e) => e.id))); for (const elevator of es) { await db.update(workOrderElevators).set({ finding: data.findings[elevator.id]?.trim() || null }).where(eq(workOrderElevators.id, elevator.id)); } }
    revalidatePath("/reports"); return { success: true, message: "Informe manual guardado y OT aprobada." };
  } catch (error) { return { success: false, error: getErrorMessage(error) }; }
}

export async function updateClientSignature(data: { workOrderId: string; signerName: string; signatureDataUrl?: string }): Promise<ActionResult> {
  const denied = await denyUnless("reports:write");
  if (denied) return denied;
  try {
    if (!data.signerName.trim()) return { success: false, error: "El nombre del firmante es obligatorio." };
    const update: { clientSignerName: string; clientSignatureUrl?: string } = { clientSignerName: data.signerName.trim() };
    if (data.signatureDataUrl) {
      update.clientSignatureUrl = await uploadToR2(buildEvidenceKey(data.workOrderId, "manual-update", Date.now(), "png"), decodeDataUrl(data.signatureDataUrl), "image/png");
    }
    await db.update(workOrders).set(update).where(eq(workOrders.id, data.workOrderId));
    revalidatePath("/reports");
    return { success: true, message: "Datos de firma actualizados." };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
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

const AUDIO_URL_TTL_SECONDS = 60 * 60;

async function loadElevatorAudios(elevatorIds: string[]): Promise<Map<string, ReportAudio[]>> {
  const byElevator = new Map<string, ReportAudio[]>();
  if (elevatorIds.length === 0) return byElevator;
  const rows = await db
    .select()
    .from(workOrderElevatorAudios)
    .where(inArray(workOrderElevatorAudios.workOrderElevatorId, elevatorIds))
    .orderBy(asc(workOrderElevatorAudios.createdAt));
  const canSign = isPrivatePdfStorageConfigured();
  for (const audio of rows) {
    const url = canSign
      ? await getSignedPrivateUrl(audio.key, { contentType: "audio/mp4", expiresIn: AUDIO_URL_TTL_SECONDS }).catch(
          () => null
        )
      : null;
    const list = byElevator.get(audio.workOrderElevatorId) ?? [];
    list.push({
      id: audio.id,
      url,
      durationMs: audio.durationMs,
      transcript: audio.transcript,
      transcriptStatus: audio.transcriptStatus,
      createdAt: audio.createdAt,
    });
    byElevator.set(audio.workOrderElevatorId, list);
  }
  return byElevator;
}

export async function getCompletedWorkOrders(): Promise<CompletedWorkOrderReport[]> {
  await requirePermission("reports:read");
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

    // Notas de voz solo de los equipos de las órdenes listadas: cada una
    // necesita una URL firmada (el bucket es privado).
    const completedIds = new Set(woRows.map((row) => row.id));
    const listedElevatorIds = elevatorRows
      .filter((e) => completedIds.has(e.workOrderId))
      .map((e) => e.id);
    const audiosByElevator = await loadElevatorAudios(listedElevatorIds);

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
        audios: audiosByElevator.get(e.id) ?? [],
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
  await requirePermission("reports:read");
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
  const denied = await denyUnless("reports:write");
  if (denied) return denied;
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

/**
 * El administrador corrige o escribe la transcripción de una nota de voz.
 * Es material interno: el portal del cliente nunca muestra audios ni
 * transcripciones, solo el texto de Hallazgos aprobado.
 */
export async function updateAudioTranscript(audioId: string, transcript: string): Promise<ActionResult> {
  const denied = await denyUnless("reports:write");
  if (denied) return denied;
  try {
    const [audio] = await db
      .select({ workOrderId: workOrderElevators.workOrderId })
      .from(workOrderElevatorAudios)
      .innerJoin(workOrderElevators, eq(workOrderElevators.id, workOrderElevatorAudios.workOrderElevatorId))
      .where(eq(workOrderElevatorAudios.id, audioId))
      .limit(1);
    if (!audio) return { success: false, error: "La nota de voz ya no existe." };
    if (!(await isWorkOrderEditable(audio.workOrderId))) {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    const text = transcript.trim().slice(0, 4000);
    await db
      .update(workOrderElevatorAudios)
      .set({ transcript: text || null, transcriptStatus: text ? "DONE" : "NONE" })
      .where(eq(workOrderElevatorAudios.id, audioId));

    revalidatePath("/reports");
    return { success: true, message: "Transcripción guardada." };
  } catch (error) {
    console.error("Error al guardar la transcripción:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Transcribe (o vuelve a transcribir) una nota de voz con Whisper y devuelve
 * el texto. Reemplaza la transcripción actual: el administrador lo pide.
 */
export async function transcribeAudioNow(
  audioId: string
): Promise<{ success: true; transcript: string | null } | { success: false; error: string }> {
  const denied = await denyUnless("reports:write");
  if (denied) return denied;
  try {
    const [audio] = await db
      .select({ workOrderId: workOrderElevators.workOrderId })
      .from(workOrderElevatorAudios)
      .innerJoin(workOrderElevators, eq(workOrderElevators.id, workOrderElevatorAudios.workOrderElevatorId))
      .where(eq(workOrderElevatorAudios.id, audioId))
      .limit(1);
    if (!audio) return { success: false, error: "La nota de voz ya no existe." };
    if (!(await isWorkOrderEditable(audio.workOrderId))) {
      return { success: false, error: "La OT aprobada ya no admite cambios." };
    }
    const outcome = await transcribeStoredAudio(audioId, { overwrite: true });
    if (outcome.status === "DONE") {
      revalidatePath("/reports");
      return { success: true, transcript: outcome.transcript };
    }
    return { success: false, error: outcome.status === "FAILED" ? outcome.error : outcome.reason };
  } catch (error) {
    console.error("Error al transcribir:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

export async function updateWorkOrderClosingNotes(
  workOrderId: string,
  closingNotes: string
): Promise<ActionResult> {
  const denied = await denyUnless("reports:write");
  if (denied) return denied;
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
  const denied = await denyUnless("reports:write");
  if (denied) return denied;
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
  const denied = await denyUnless("reports:write");
  if (denied) return denied;
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
  const denied = await denyUnless("reports:write");
  if (denied) return denied;
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
