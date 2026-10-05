"use server";

import { revalidatePath } from "next/cache";
import { sql, eq, and, isNull, inArray } from "drizzle-orm";
import {
  db,
  workOrders,
  workOrderElevators,
  workOrderTasks,
  workOrderElevatorPhotos,
  elevatorUnities,
  safetyTemplates,
  workOrderElevatorSafety,
  workOrderElevatorSafetyItems,
  serviceTypes,
} from "@/db/index";
import { getSessionUserId } from "@/features/auth/server";
import { checklistQuestion, parseChecklistItems } from "@/features/safety/checklist-content";
import {
  deleteR2ObjectByUrl,
  buildElevatorPhotoKey,
  buildSignatureKey,
  uploadToR2,
} from "@/lib/r2";
import { generateUuid } from "@/lib/uuid";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (dataUrl decodificada)

export interface ActionState {
  success: boolean;
  message?: string;
  error?: string;
}

interface TechnicianSession extends ActionState {
  technicianId?: string;
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

async function requireTechnician(): Promise<TechnicianSession> {
  const technicianId = await getSessionUserId();
  if (!technicianId) {
    return { success: false, error: "Sesión no válida. Vuelve a iniciar sesión." };
  }
  return { success: true, technicianId };
}

async function assertOwnedWorkOrder(
  technicianId: string,
  workOrderId: string
): Promise<string> {
  const rows = await db
    .select({ id: workOrders.id })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.id, workOrderId),
        eq(workOrders.technicianId, technicianId),
        isNull(workOrders.deletedAt)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error("No tienes acceso a esta orden de trabajo.");
  }
  return row.id;
}

async function getElevatorWorkOrderByTechnician(
  technicianId: string,
  elevatorId: string
): Promise<{ workOrderId: string }> {
  const rows = await db
    .select({ workOrderId: workOrderElevators.workOrderId })
    .from(workOrderElevators)
    .innerJoin(
      workOrders,
      and(
        eq(workOrders.id, workOrderElevators.workOrderId),
        eq(workOrders.technicianId, technicianId),
        isNull(workOrders.deletedAt)
      )
    )
    .where(eq(workOrderElevators.id, elevatorId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error("No tienes acceso a este equipo.");
  }
  return row;
}

async function assertOwnedSafetyItem(
  technicianId: string,
  itemId: string
): Promise<string> {
  const rows = await db
    .select({ safetyId: workOrderElevatorSafetyItems.safetyRecordId })
    .from(workOrderElevatorSafetyItems)
    .innerJoin(
      workOrderElevatorSafety,
      eq(workOrderElevatorSafety.id, workOrderElevatorSafetyItems.safetyRecordId)
    )
    .innerJoin(
      workOrderElevators,
      eq(workOrderElevators.id, workOrderElevatorSafety.workOrderElevatorId)
    )
    .innerJoin(
      workOrders,
      and(
        eq(workOrders.id, workOrderElevators.workOrderId),
        eq(workOrders.technicianId, technicianId),
        isNull(workOrders.deletedAt)
      )
    )
    .where(eq(workOrderElevatorSafetyItems.id, itemId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error("No tienes acceso a este ítem de seguridad.");
  }
  return row.safetyId;
}

const PATHS_TO_REVALIDATE = [
  "/technician/work-orders",
  "/work-orders",
  "/routes",
];

function revalidateTechnicianUrls() {
  for (const path of PATHS_TO_REVALIDATE) {
    revalidatePath(path);
  }
}

/**
 * Pone en "Mantenimiento" a todos los equipos asignados a una OT.
 */
async function setEquipmentInMaintenance(workOrderId: string): Promise<void> {
  const rows = await db
    .select({ elevatorUnityId: workOrderElevators.elevatorUnityId })
    .from(workOrderElevators)
    .where(eq(workOrderElevators.workOrderId, workOrderId));
  const ids = Array.from(
    new Set(rows.map((r) => r.elevatorUnityId).filter(Boolean))
  );
  if (ids.length === 0) return;
  await db
    .update(elevatorUnities)
    .set({ status: "MAINTENANCE" })
    .where(inArray(elevatorUnities.id, ids));
}

/**
 * Crea (y completa) los registros de seguridad de la OT a partir de las
 * plantillas activas que aplican al tipo de equipo de cada elevador.
 */
async function ensureSafetyRecords(workOrderId: string): Promise<void> {
  const elevators = await db
    .select({ id: workOrderElevators.id, equipmentTypeId: elevatorUnities.elevatorTypeId })
    .from(workOrderElevators)
    .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
    .where(eq(workOrderElevators.workOrderId, workOrderId));

  for (const elevator of elevators) {
    const existing = await db.select({ id: workOrderElevatorSafety.id })
      .from(workOrderElevatorSafety)
      .where(eq(workOrderElevatorSafety.workOrderElevatorId, elevator.id))
      .limit(1);
    if (existing.length > 0) continue;

    const template = await db.select().from(safetyTemplates).where(and(
      eq(safetyTemplates.isActive, true),
      eq(safetyTemplates.equipmentTypeId, elevator.equipmentTypeId)
    )).orderBy(safetyTemplates.createdAt).limit(1);
    const selected = template[0];
    if (!selected) throw new Error("No existe un checklist de seguridad activo para uno de los equipos.");

    // `parseChecklistItems` tolera que el contenido venga como texto JSON.
    const questions = parseChecklistItems(selected.content)
      .map((item) => checklistQuestion(item))
      .filter((question) => question.length > 0);

    const recordId = generateUuid();
    await db.insert(workOrderElevatorSafety).values({
      id: recordId,
      workOrderElevatorId: elevator.id,
      templateId: selected.id,
      templateVersion: selected.version,
      templateSnapshot: selected.content,
      status: "PENDING",
    });
    if (questions.length > 0) {
      await db.insert(workOrderElevatorSafetyItems).values(
        questions.map((question, index) => ({
          id: generateUuid(),
          safetyRecordId: recordId,
          question,
          orderIndex: index,
        }))
      );
    }
  }
}

export async function startWorkOrder(workOrderId: string): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    await assertOwnedWorkOrder(session.technicianId, workOrderId);

    const already = await db
      .select({ status: workOrders.status, startedAt: workOrders.startedAt })
      .from(workOrders)
      .where(eq(workOrders.id, workOrderId))
      .limit(1);
    const current = already[0];
    if (current?.status === "COMPLETED") {
      return { success: false, error: "Esta orden ya fue completada." };
    }
    if (current?.status === "IN_PROGRESS") {
      // Idempotente: también cubre órdenes iniciadas antes de esta funcionalidad.
      await ensureSafetyRecords(workOrderId);
      await setEquipmentInMaintenance(workOrderId);
      await markEquipmentStarted(workOrderId, current.startedAt ?? Date.now());
      return { success: true, message: "La orden ya estaba en curso." };
    }

    const now = Date.now();
    await db
      .update(workOrders)
      .set({ status: "IN_PROGRESS", startedAt: now })
      .where(eq(workOrders.id, workOrderId));

    await ensureSafetyRecords(workOrderId);
    await setEquipmentInMaintenance(workOrderId);
    await markEquipmentStarted(workOrderId, now);

    revalidateTechnicianUrls();
    return { success: true, message: "Orden iniciada. ¡A trabajar!" };
  } catch (error) {
    console.error("startWorkOrder:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al iniciar la orden.",
    };
  }
}

/** Registra el inicio real de los equipos que aún no tienen timestamp. */
async function markEquipmentStarted(workOrderId: string, startedAt: number): Promise<void> {
  await db
    .update(workOrderElevators)
    .set({ startedAt })
    .where(
      and(
        eq(workOrderElevators.workOrderId, workOrderId),
        isNull(workOrderElevators.startedAt)
      )
    );
}

export async function saveSafetyItem(
  itemId: string,
  data: { response?: string | null; observations?: string | null }
): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    await assertOwnedSafetyItem(session.technicianId, itemId);

    const update: Record<string, unknown> = {};
    if (data.response !== undefined) {
      const clean = (data.response ?? "").trim().toUpperCase();
      if (!["", "SI", "NO", "NA"].includes(clean)) {
        return { success: false, error: "Respuesta inválida para el ítem." };
      }
      update.response = clean || null;
      update.answeredAt = clean ? Date.now() : null;
      if (clean && clean !== "NO") {
        update.observations = null;
      }
    }
    if (data.observations !== undefined) {
      update.observations = (data.observations ?? "").trim().slice(0, 2000) || null;
    }
    if (Object.keys(update).length === 0) {
      return { success: true, message: "Sin cambios." };
    }

    await db
      .update(workOrderElevatorSafetyItems)
      .set(update)
      .where(eq(workOrderElevatorSafetyItems.id, itemId));

    revalidateTechnicianUrls();
    return { success: true, message: "Respuesta guardada." };
  } catch (error) {
    console.error("saveSafetyItem:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al guardar la respuesta.",
    };
  }
}

export async function saveSafetyNotes(
  elevatorId: string,
  notes: string
): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    await getElevatorWorkOrderByTechnician(session.technicianId, elevatorId);

    const clean = (notes ?? "").trim().slice(0, 4000);
    const rows = await db
      .select({ id: workOrderElevatorSafety.id })
      .from(workOrderElevatorSafety)
      .where(eq(workOrderElevatorSafety.workOrderElevatorId, elevatorId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return {
        success: false,
        error: "El checklist de seguridad no existe para este equipo.",
      };
    }

    await db
      .update(workOrderElevatorSafety)
      .set({ notes: clean || null })
      .where(eq(workOrderElevatorSafety.id, row.id));

    revalidateTechnicianUrls();
    return { success: true, message: "Observaciones guardadas." };
  } catch (error) {
    console.error("saveSafetyNotes:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al guardar observaciones.",
    };
  }
}

export type SafetyGeolocation = { latitude: number; longitude: number } | null;

export async function completeElevatorSafety(args: {
  elevatorId: string;
  geolocation: SafetyGeolocation;
}): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    const { elevatorId, geolocation } = args;

    await getElevatorWorkOrderByTechnician(session.technicianId, elevatorId);

    const rows = await db
      .select()
      .from(workOrderElevatorSafety)
      .where(eq(workOrderElevatorSafety.workOrderElevatorId, elevatorId))
      .limit(1);
    const safetyRow = rows[0];
    if (!safetyRow) {
      return {
        success: false,
        error: "No existe el checklist de seguridad de este equipo.",
      };
    }
    if (safetyRow.status === "COMPLETED") {
      return { success: true, message: "La seguridad ya fue completada." };
    }

    const items = await db
      .select({ id: workOrderElevatorSafetyItems.id, response: workOrderElevatorSafetyItems.response })
      .from(workOrderElevatorSafetyItems)
      .where(eq(workOrderElevatorSafetyItems.safetyRecordId, safetyRow.id));
    if (items.some((item) => !item.response)) {
      return {
        success: false,
        error: "Debes responder todas las preguntas antes de completar.",
      };
    }

    const now = Date.now();
    await db
      .update(workOrderElevatorSafety)
      .set({
        status: "COMPLETED",
        geolocation: geolocation ?? null,
        completedAt: now,
      })
      .where(eq(workOrderElevatorSafety.id, safetyRow.id));

    revalidateTechnicianUrls();
    return { success: true, message: "Seguridad completada. ¡A trabajar!" };
  } catch (error) {
    console.error("completeElevatorSafety:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al completar la seguridad.",
    };
  }
}

export async function updateWorkOrderTask(
  taskId: string,
  data: {
    isCompleted?: boolean;
    status?: string;
    observations?: string | null;
  }
): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    const rows = await db
      .select({ elevatorId: workOrderTasks.workOrderElevatorId })
      .from(workOrderTasks)
      .innerJoin(
        workOrderElevators,
        eq(workOrderElevators.id, workOrderTasks.workOrderElevatorId)
      )
      .innerJoin(
        workOrders,
        and(
          eq(workOrders.id, workOrderElevators.workOrderId),
          eq(workOrders.technicianId, session.technicianId),
          isNull(workOrders.deletedAt)
        )
      )
      .where(eq(workOrderTasks.id, taskId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return { success: false, error: "No tienes acceso a esta tarea." };
    }

    const update: Record<string, unknown> = {};
    if (data.isCompleted !== undefined) {
      const completed = Boolean(data.isCompleted);
      update.isCompleted = completed;
      update.status = completed ? "COMPLETED" : "PENDING";
      update.completedAt = completed ? Date.now() : null;
    }
    if (data.status !== undefined) {
      const status = (data.status ?? "").trim().toUpperCase();
      if (!["PENDING", "COMPLETED", "SKIPPED", "NOT_APPLICABLE"].includes(status)) {
        return { success: false, error: "Estado de tarea inválido." };
      }
      update.status = status;
      update.isCompleted = status === "COMPLETED";
      update.completedAt =
        status === "COMPLETED" ? Date.now() : null;
    }
    if (data.observations !== undefined) {
      update.observations = (data.observations ?? "").trim().slice(0, 2000) || null;
    }
    if (Object.keys(update).length === 0) {
      return { success: true, message: "Sin cambios." };
    }

    await db
      .update(workOrderTasks)
      .set(update)
      .where(eq(workOrderTasks.id, taskId));

    revalidateTechnicianUrls();
    return { success: true, message: "Tarea actualizada." };
  } catch (error) {
    console.error("updateWorkOrderTask:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al actualizar la tarea.",
    };
  }
}

export async function bulkUpdateModuleTasks(args: {
  elevatorId: string;
  moduleId: string | null;
  isCompleted: boolean;
}): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    const { elevatorId, moduleId, isCompleted } = args;
    await getElevatorWorkOrderByTechnician(session.technicianId, elevatorId);

    const where = moduleId
      ? and(
          eq(workOrderTasks.workOrderElevatorId, elevatorId),
          eq(workOrderTasks.moduleId, moduleId)
        )
      : and(
          eq(workOrderTasks.workOrderElevatorId, elevatorId),
          isNull(workOrderTasks.moduleId)
        );

    const completed = Boolean(isCompleted);
    await db
      .update(workOrderTasks)
      .set({
        isCompleted: completed,
        status: completed ? "COMPLETED" : "PENDING",
        completedAt: completed ? Date.now() : null,
      })
      .where(where);

    revalidateTechnicianUrls();
    return {
      success: true,
      message: completed
        ? "Módulo marcado como completado."
        : "Módulo desmarcado.",
    };
  } catch (error) {
    console.error("bulkUpdateModuleTasks:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al actualizar el módulo.",
    };
  }
}

export async function updateElevatorFindings(args: {
  elevatorId: string;
  findings: string;
}): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    const { elevatorId, findings } = args;
    await getElevatorWorkOrderByTechnician(session.technicianId, elevatorId);

    const clean = (findings ?? "").trim().slice(0, 2000);
    await db
      .update(workOrderElevators)
      .set({ finding: clean || null })
      .where(eq(workOrderElevators.id, elevatorId));

    revalidateTechnicianUrls();
    return { success: true, message: "Hallazgos guardados." };
  } catch (error) {
    console.error("updateElevatorFindings:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al guardar los hallazgos.",
    };
  }
}

export type ElevatorFinishMode = "all_completed" | "partial";

const MIN_PHOTOS = 4;

/**
 * Finaliza el checklist de mantenimiento de un equipo. `mode` indica si las
 * tareas pendientes deben marcarse como completadas ("all_completed") o
 * dejarse tal cual en la base ("partial"). El safety debe estar completo y,
 * para servicios preventivos/correctivos, se exigen al menos 4 fotos.
 */
export async function completeElevator(args: {
  elevatorId: string;
  mode: ElevatorFinishMode;
}): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    const { elevatorId, mode } = args;
    if (mode !== "all_completed" && mode !== "partial") {
      return { success: false, error: "Modo de finalización inválido." };
    }

    await getElevatorWorkOrderByTechnician(session.technicianId, elevatorId);

    const safety = await db
      .select({ status: workOrderElevatorSafety.status })
      .from(workOrderElevatorSafety)
      .where(eq(workOrderElevatorSafety.workOrderElevatorId, elevatorId))
      .limit(1);
    if (safety[0]?.status !== "COMPLETED") {
      return {
        success: false,
        error:
          "Debes completar la seguridad del equipo antes de finalizar el mantenimiento.",
      };
    }

    // Evidencia fotográfica mínima (solo preventivos/correctivos).
    const woRows = await db
      .select({ serviceTypeCode: serviceTypes.code })
      .from(workOrders)
      .innerJoin(
        workOrderElevators,
        eq(workOrderElevators.workOrderId, workOrders.id)
      )
      .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .where(eq(workOrderElevators.id, elevatorId))
      .limit(1);
    const serviceTypeCode = woRows[0]?.serviceTypeCode ?? null;
    const photosRequired =
      serviceTypeCode === "PREV" || serviceTypeCode === "CORR";
    if (photosRequired) {
      const photos = await db
        .select({ count: sql<number>`count(*)` })
        .from(workOrderElevatorPhotos)
        .where(eq(workOrderElevatorPhotos.workOrderElevatorId, elevatorId));
      const photoCount = photos[0]?.count ?? 0;
      if (photoCount < MIN_PHOTOS) {
        return {
          success: false,
          error: `Debes subir al menos ${MIN_PHOTOS} fotos. Faltan ${
            MIN_PHOTOS - photoCount
          }.`,
        };
      }
    }

    if (mode === "all_completed") {
      await db
        .update(workOrderTasks)
        .set({
          isCompleted: true,
          status: "COMPLETED",
          completedAt: Date.now(),
        })
        .where(
          and(
            eq(workOrderTasks.workOrderElevatorId, elevatorId),
            eq(workOrderTasks.isCompleted, false)
          )
        );
    }

    await db
      .update(workOrderElevators)
      .set({ status: "COMPLETED", completedAt: Date.now() })
      .where(eq(workOrderElevators.id, elevatorId));

    revalidateTechnicianUrls();
    return { success: true, message: "Equipo finalizado." };
  } catch (error) {
    console.error("completeElevator:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al finalizar el equipo.",
    };
  }
}

export async function addElevatorPhoto(args: {
  elevatorId: string;
  taskId?: string | null;
  tag: string;
  description?: string | null;
  dataUrl: string;
}): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    const { elevatorId, taskId, tag: rawTag, description, dataUrl } = args;
    const tag = (rawTag ?? "").trim().toUpperCase();
    if (!["BEFORE", "AFTER", "POINT"].includes(tag)) {
      return { success: false, error: "Tipo de foto inválido." };
    }
    if (!dataUrl) {
      return { success: false, error: "No se recibió la imagen." };
    }

    const rel = await getElevatorWorkOrderByTechnician(session.technicianId, elevatorId);

    if (taskId) {
      const task = await db
        .select({ elevatorId: workOrderTasks.workOrderElevatorId })
        .from(workOrderTasks)
        .where(eq(workOrderTasks.id, taskId))
        .limit(1);
      if (task[0]?.elevatorId !== elevatorId) {
        return { success: false, error: "La tarea no pertenece a este equipo." };
      }
    }

    const bytes = decodeDataUrl(dataUrl);
    const url = await uploadToR2(
      buildElevatorPhotoKey(rel.workOrderId, elevatorId, "jpg"),
      bytes,
      "image/jpeg"
    );

    await db.insert(workOrderElevatorPhotos).values({
      id: generateUuid(),
      workOrderElevatorId: elevatorId,
      workOrderTaskId: taskId ?? null,
      url,
      tag,
      description: description?.trim().slice(0, 1000) || null,
      createdAt: Date.now(),
    });

    revalidateTechnicianUrls();
    return { success: true, message: "Foto agregada." };
  } catch (error) {
    console.error("addElevatorPhoto:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al subir la foto.",
    };
  }
}

export async function removeElevatorPhoto(photoId: string): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    const rows = await db
      .select({
        id: workOrderElevatorPhotos.id,
        url: workOrderElevatorPhotos.url,
        elevatorId: workOrderElevatorPhotos.workOrderElevatorId,
      })
      .from(workOrderElevatorPhotos)
      .where(eq(workOrderElevatorPhotos.id, photoId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return { success: false, error: "La foto no existe." };
    }

    await getElevatorWorkOrderByTechnician(session.technicianId, row.elevatorId);

    await deleteR2ObjectByUrl(row.url).catch(() => undefined);
    await db
      .delete(workOrderElevatorPhotos)
      .where(eq(workOrderElevatorPhotos.id, row.id));

    revalidateTechnicianUrls();
    return { success: true, message: "Foto eliminada." };
  } catch (error) {
    console.error("removeElevatorPhoto:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al eliminar la foto.",
    };
  }
}

export type ElevatorFinalStatus = "OPERATIVE" | "OUT_OF_SERVICE" | "UNCOMPLETED_MAINTENANCE";

export async function completeWorkOrder(args: {
  workOrderId: string;
  clientName: string;
  signatureDataUrl: string;
  elevatorStatuses: Record<string, ElevatorFinalStatus>;
}): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    const { workOrderId, clientName, signatureDataUrl, elevatorStatuses } = args;

    if (!workOrderId || !signatureDataUrl) {
      return { success: false, error: "Faltan datos (firma o orden)." };
    }

    await assertOwnedWorkOrder(session.technicianId, workOrderId);

    const elevators = await db
      .select({
        id: workOrderElevators.id,
        status: workOrderElevators.status,
        elevatorUnityId: workOrderElevators.elevatorUnityId,
      })
      .from(workOrderElevators)
      .where(eq(workOrderElevators.workOrderId, workOrderId));

    const elevatorIds = elevators.map((e) => e.id);

    const safetyRows = await db
      .select({
        elevatorId: workOrderElevatorSafety.workOrderElevatorId,
        status: workOrderElevatorSafety.status,
      })
      .from(workOrderElevatorSafety)
      .where(inArray(workOrderElevatorSafety.workOrderElevatorId, elevatorIds));
    const safetyByElevator = new Map(
      safetyRows.map((s) => [s.elevatorId, s.status])
    );
    for (const elevator of elevators) {
      if (safetyByElevator.get(elevator.id) !== "COMPLETED") {
        return {
          success: false,
          error:
            "Todos los equipos deben tener la seguridad completada antes de finalizar la orden.",
        };
      }
    }

    const incompleteElevators = elevators.filter(
      (e) => e.status !== "COMPLETED"
    );
    if (incompleteElevators.length > 0) {
      return {
        success: false,
        error:
          "Todos los equipos deben tener su checklist terminado antes de finalizar la orden.",
      };
    }

    const allowed = new Set<string>(["OPERATIVE", "OUT_OF_SERVICE", "UNCOMPLETED_MAINTENANCE"]);
    const finalStatuses = new Map<string, ElevatorFinalStatus>();
    for (const elevator of elevators) {
      const value = (elevatorStatuses ?? {})[elevator.id];
      if (!allowed.has(value)) {
        return {
          success: false,
          error:
            "Debes indicar el estado final de cada equipo (Operativo, Fuera de Servicio o Mantenimiento sin culminar).",
        };
      }
      finalStatuses.set(elevator.id, value as ElevatorFinalStatus);
    }

    const signatureBytes = decodeDataUrl(signatureDataUrl);
    const signatureUrl = await uploadToR2(
      buildSignatureKey(workOrderId),
      signatureBytes,
      "image/png"
    );

    const now = Date.now();
    await db
      .update(workOrders)
      .set({
        status: "COMPLETED",
        completedAt: now,
        clientSignatureUrl: signatureUrl,
        clientSignerName: clientName || null,
      })
      .where(eq(workOrders.id, workOrderId));

    for (const elevator of elevators) {
      const status = finalStatuses.get(elevator.id)!;
      await db
        .update(workOrderElevators)
        .set({ status: "COMPLETED", finalStatus: status, completedAt: now })
        .where(eq(workOrderElevators.id, elevator.id));
      await db
        .update(elevatorUnities)
        .set({ status })
        .where(eq(elevatorUnities.id, elevator.elevatorUnityId));
    }

    revalidateTechnicianUrls();
    return { success: true, message: "Orden completada. ¡Buen trabajo!" };
  } catch (error) {
    console.error("completeWorkOrder:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al completar la orden.",
    };
  }
}
