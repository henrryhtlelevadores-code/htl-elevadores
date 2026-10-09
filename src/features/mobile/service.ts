import "server-only";
import { revalidatePath } from "next/cache";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  elevatorUnities,
  safetyTemplates,
  serviceTypes,
  workOrderElevatorAudios,
  workOrderElevatorPhotos,
  workOrderElevatorSafety,
  workOrderElevatorSafetyItems,
  workOrderElevators,
  workOrderTasks,
  workOrders,
} from "@/db";
import {
  getTechnicianWorkOrderExecution,
  getTechnicianWorkOrders,
} from "@/features/technician/server/queries";
import { checklistQuestion, parseChecklistItems } from "@/features/safety/checklist-content";
import { MAX_IMAGE_BYTES, validateImageUpload } from "@/lib/image-validation";
import {
  buildElevatorPhotoKey,
  buildSignatureKey,
  deletePrivatePdf,
  deleteR2ObjectByUrl,
  getSignedPrivateUrl,
  isPrivatePdfStorageConfigured,
  uploadPrivateObject,
  uploadToR2,
} from "@/lib/r2";
import { generateUuid } from "@/lib/uuid";
import { clientTime, invalid, notFound, optionalText, requireUuid, unavailable } from "./http";

/**
 * Operaciones de la app de técnicos (`/api/mobile/v1`).
 *
 * Aplican las mismas reglas que la vista web del técnico
 * (`src/features/technician/server/actions.ts`), con tres diferencias que
 * exige el trabajo sin señal:
 *
 * - Idempotencia: la app reintenta envíos, así que repetir una operación ya
 *   aplicada responde bien y no cambia nada. Los registros nuevos (ítems de
 *   seguridad, fotos, audios) llevan el ID que generó la app.
 * - Hora del teléfono: cada cambio trae la hora en que se hizo, que se
 *   respeta dentro de un rango razonable (ver `clientTime`).
 * - Lotes: respuestas de seguridad y tareas llegan varias por petición.
 *
 * Toda función recibe el id del técnico ya autenticado y comprueba que el
 * recurso le pertenece; un recurso ajeno responde 404.
 */

const MIN_PHOTOS = 4;
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const AUDIO_URL_TTL_SECONDS = 60 * 60;
const SAFETY_RESPONSES = new Set(["SI", "NO", "NA"]);
const TASK_STATUSES = new Set(["PENDING", "COMPLETED", "SKIPPED", "NOT_APPLICABLE"]);
const FINAL_STATUSES = new Set(["OPERATIVE", "OUT_OF_SERVICE", "UNCOMPLETED_MAINTENANCE"]);

/** En la app, el mínimo de fotos solo aplica a mantenimientos preventivos. */
const photosRequiredFor = (serviceTypeCode: string | null) => serviceTypeCode === "PREV";

function revalidatePanel() {
  for (const path of ["/technician/work-orders", "/work-orders", "/routes", "/reports"]) {
    revalidatePath(path);
  }
}

// ==========================================
// Pertenencia
// ==========================================

async function ownedWorkOrder(technicianId: string, workOrderId: string) {
  const [row] = await db
    .select({
      id: workOrders.id,
      status: workOrders.status,
      startedAt: workOrders.startedAt,
      serviceTypeCode: serviceTypes.code,
    })
    .from(workOrders)
    .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .where(
      and(
        eq(workOrders.id, workOrderId),
        eq(workOrders.technicianId, technicianId),
        isNull(workOrders.deletedAt)
      )
    )
    .limit(1);
  if (!row) throw notFound("La orden de trabajo no existe o no está asignada a ti.");
  return row;
}

async function ownedElevator(technicianId: string, elevatorId: string) {
  const [row] = await db
    .select({
      id: workOrderElevators.id,
      status: workOrderElevators.status,
      workOrderId: workOrderElevators.workOrderId,
      workOrderStatus: workOrders.status,
      serviceTypeCode: serviceTypes.code,
    })
    .from(workOrderElevators)
    .innerJoin(
      workOrders,
      and(
        eq(workOrders.id, workOrderElevators.workOrderId),
        eq(workOrders.technicianId, technicianId),
        isNull(workOrders.deletedAt)
      )
    )
    .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
    .where(eq(workOrderElevators.id, elevatorId))
    .limit(1);
  if (!row) throw notFound("El equipo no existe o no pertenece a una orden tuya.");
  return row;
}

async function safetyRecordOf(elevatorId: string) {
  const [row] = await db
    .select({ id: workOrderElevatorSafety.id, status: workOrderElevatorSafety.status })
    .from(workOrderElevatorSafety)
    .where(eq(workOrderElevatorSafety.workOrderElevatorId, elevatorId))
    .limit(1);
  return row ?? null;
}

// ==========================================
// Lecturas
// ==========================================

export async function listWorkOrders(technicianId: string) {
  return getTechnicianWorkOrders(technicianId);
}

/** Preguntas de la plantilla de seguridad activa de cada tipo de equipo. */
async function safetyQuestionsByType(typeIds: string[]) {
  const result = new Map<string, { template: typeof safetyTemplates.$inferSelect; questions: string[] }>();
  if (typeIds.length === 0) return result;
  const templates = await db
    .select()
    .from(safetyTemplates)
    .where(and(eq(safetyTemplates.isActive, true), inArray(safetyTemplates.equipmentTypeId, typeIds)))
    .orderBy(asc(safetyTemplates.createdAt));
  for (const template of templates) {
    const typeId = template.equipmentTypeId;
    // La más antigua activa de cada tipo, igual que en la vista web.
    if (!typeId || result.has(typeId)) continue;
    const questions = parseChecklistItems(template.content)
      .map((item) => checklistQuestion(item))
      .filter((question) => question.length > 0);
    result.set(typeId, { template, questions });
  }
  return result;
}

export async function getWorkOrder(technicianId: string, workOrderId: string) {
  const detail = await getTechnicianWorkOrderExecution(technicianId, workOrderId);
  if (!detail) throw notFound("La orden de trabajo no existe o no está asignada a ti.");

  const elevatorIds = detail.elevators.map((elevator) => elevator.id);
  const extra =
    elevatorIds.length > 0
      ? await db
          .select({
            id: workOrderElevators.id,
            startedAt: workOrderElevators.startedAt,
            completedAt: workOrderElevators.completedAt,
            equipmentTypeId: elevatorUnities.elevatorTypeId,
          })
          .from(workOrderElevators)
          .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
          .where(inArray(workOrderElevators.id, elevatorIds))
      : [];
  const extraById = new Map(extra.map((row) => [row.id, row]));
  const templates = await safetyQuestionsByType(
    [...new Set(extra.map((row) => row.equipmentTypeId).filter((id): id is string => !!id))]
  );

  const audioRows =
    elevatorIds.length > 0
      ? await db
          .select()
          .from(workOrderElevatorAudios)
          .where(inArray(workOrderElevatorAudios.workOrderElevatorId, elevatorIds))
          .orderBy(asc(workOrderElevatorAudios.createdAt))
      : [];
  const canSign = isPrivatePdfStorageConfigured();
  const audiosByElevator = new Map<string, unknown[]>();
  for (const audio of audioRows) {
    const list = audiosByElevator.get(audio.workOrderElevatorId) ?? [];
    list.push({
      id: audio.id,
      // URL firmada de corta duración; el archivo no es público.
      url: canSign
        ? await getSignedPrivateUrl(audio.key, {
            contentType: "audio/mp4",
            expiresIn: AUDIO_URL_TTL_SECONDS,
          })
        : null,
      durationMs: audio.durationMs,
      transcript: audio.transcript,
      transcriptStatus: audio.transcriptStatus,
      createdAt: audio.createdAt,
    });
    audiosByElevator.set(audio.workOrderElevatorId, list);
  }

  const photosRequired = photosRequiredFor(detail.serviceType?.code ?? null);
  return {
    ...detail,
    elevators: detail.elevators.map((elevator) => {
      const info = extraById.get(elevator.id);
      const template = info?.equipmentTypeId ? templates.get(info.equipmentTypeId) : undefined;
      return {
        ...elevator,
        photosRequired,
        startedAt: info?.startedAt ?? null,
        completedAt: info?.completedAt ?? null,
        // Con esto la app arma el checklist sin señal antes de iniciar.
        safetyTemplate: (template?.questions ?? []).map((question, orderIndex) => ({
          question,
          orderIndex,
        })),
        audios: audiosByElevator.get(elevator.id) ?? [],
      };
    }),
  };
}

// ==========================================
// Inicio de la orden
// ==========================================

interface StartElevatorInput {
  id?: unknown;
  safetyItems?: unknown;
}

export async function startWorkOrder(
  technicianId: string,
  workOrderId: string,
  body: Record<string, unknown>
) {
  const order = await ownedWorkOrder(technicianId, workOrderId);
  if (order.status === "COMPLETED") return "La orden ya fue completada.";

  const startedAt = order.startedAt ?? clientTime(body.startedAt);
  if (order.status !== "IN_PROGRESS") {
    await db
      .update(workOrders)
      .set({ status: "IN_PROGRESS", startedAt })
      .where(eq(workOrders.id, workOrderId));
  }

  // IDs de los ítems de seguridad que la app ya creó en el teléfono.
  const appItemIds = new Map<string, Map<number, string>>();
  for (const input of Array.isArray(body.elevators) ? (body.elevators as StartElevatorInput[]) : []) {
    if (typeof input?.id !== "string" || !Array.isArray(input.safetyItems)) continue;
    const byIndex = new Map<number, string>();
    for (const item of input.safetyItems as { id?: unknown; orderIndex?: unknown }[]) {
      const orderIndex = Number(item?.orderIndex);
      if (Number.isInteger(orderIndex) && orderIndex >= 0) {
        byIndex.set(orderIndex, requireUuid(item?.id, "El ítem de seguridad"));
      }
    }
    appItemIds.set(input.id, byIndex);
  }

  const elevators = await db
    .select({
      id: workOrderElevators.id,
      elevatorUnityId: workOrderElevators.elevatorUnityId,
      equipmentTypeId: elevatorUnities.elevatorTypeId,
    })
    .from(workOrderElevators)
    .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
    .where(eq(workOrderElevators.workOrderId, workOrderId));
  const templates = await safetyQuestionsByType(
    [...new Set(elevators.map((e) => e.equipmentTypeId).filter((id): id is string => !!id))]
  );

  for (const elevator of elevators) {
    if (await safetyRecordOf(elevator.id)) continue;
    const template = elevator.equipmentTypeId ? templates.get(elevator.equipmentTypeId) : undefined;
    if (!template) {
      throw invalid("No existe un checklist de seguridad activo para uno de los equipos.");
    }
    const recordId = generateUuid();
    await db.insert(workOrderElevatorSafety).values({
      id: recordId,
      workOrderElevatorId: elevator.id,
      templateId: template.template.id,
      templateVersion: template.template.version,
      templateSnapshot: template.template.content,
      status: "PENDING",
    });
    if (template.questions.length > 0) {
      const ids = appItemIds.get(elevator.id);
      // Las preguntas salen de la plantilla del servidor; de la app solo se
      // toma el ID, para que sus respuestas posteriores encuentren el ítem.
      await db
        .insert(workOrderElevatorSafetyItems)
        .values(
          template.questions.map((question, orderIndex) => ({
            id: ids?.get(orderIndex) ?? generateUuid(),
            safetyRecordId: recordId,
            question,
            orderIndex,
          }))
        )
        .onConflictDoNothing();
    }
  }

  const unityIds = [...new Set(elevators.map((e) => e.elevatorUnityId).filter(Boolean))];
  if (unityIds.length > 0) {
    await db.update(elevatorUnities).set({ status: "MAINTENANCE" }).where(inArray(elevatorUnities.id, unityIds));
  }
  await db
    .update(workOrderElevators)
    .set({ startedAt })
    .where(and(eq(workOrderElevators.workOrderId, workOrderId), isNull(workOrderElevators.startedAt)));

  revalidatePanel();
  return "Orden iniciada.";
}

// ==========================================
// Seguridad
// ==========================================

export async function saveSafetyItems(
  technicianId: string,
  elevatorId: string,
  body: Record<string, unknown>
) {
  await ownedElevator(technicianId, elevatorId);
  const safety = await safetyRecordOf(elevatorId);
  if (!safety) throw invalid("El checklist de seguridad no existe; inicia la orden primero.");
  // Un checklist ya aprobado no se modifica; el reintento se da por bueno.
  if (safety.status === "COMPLETED") return "La seguridad ya fue completada.";

  const items = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
  for (const item of items) {
    const id = requireUuid(item?.id, "El ítem de seguridad");
    const response = typeof item.response === "string" ? item.response.trim().toUpperCase() : "";
    if (response && !SAFETY_RESPONSES.has(response)) {
      throw invalid("Respuesta inválida para un ítem de seguridad.");
    }
    await db
      .update(workOrderElevatorSafetyItems)
      .set({
        response: response || null,
        answeredAt: response ? clientTime(item.answeredAt) : null,
        // La observación solo tiene sentido cuando la respuesta es "No".
        observations: response === "NO" ? optionalText(item.observations, 2000) : null,
      })
      // El ítem debe ser de este checklist: no se toca el de otro equipo.
      .where(
        and(
          eq(workOrderElevatorSafetyItems.id, id),
          eq(workOrderElevatorSafetyItems.safetyRecordId, safety.id)
        )
      );
  }
  revalidatePanel();
  return "Respuestas guardadas.";
}

export async function completeSafety(
  technicianId: string,
  elevatorId: string,
  body: Record<string, unknown>
) {
  await ownedElevator(technicianId, elevatorId);
  const safety = await safetyRecordOf(elevatorId);
  if (!safety) throw invalid("El checklist de seguridad no existe; inicia la orden primero.");
  if (safety.status === "COMPLETED") return "La seguridad ya fue completada.";

  const items = await db
    .select({ response: workOrderElevatorSafetyItems.response })
    .from(workOrderElevatorSafetyItems)
    .where(eq(workOrderElevatorSafetyItems.safetyRecordId, safety.id));
  if (items.some((item) => !item.response)) {
    throw invalid("Debes responder todas las preguntas antes de completar.");
  }

  const geo = body.geolocation as { latitude?: unknown; longitude?: unknown } | null | undefined;
  const latitude = Number(geo?.latitude);
  const longitude = Number(geo?.longitude);
  const geolocation =
    geo && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;

  await db
    .update(workOrderElevatorSafety)
    .set({ status: "COMPLETED", geolocation, completedAt: clientTime(body.completedAt) })
    .where(eq(workOrderElevatorSafety.id, safety.id));
  revalidatePanel();
  return "Seguridad completada.";
}

// ==========================================
// Tareas y hallazgos
// ==========================================

export async function saveTasks(
  technicianId: string,
  elevatorId: string,
  body: Record<string, unknown>
) {
  const elevator = await ownedElevator(technicianId, elevatorId);
  // Tras cerrar la orden el informe no cambia; el reintento se da por bueno.
  if (elevator.workOrderStatus === "COMPLETED") return "La orden ya fue completada.";

  const tasks = Array.isArray(body.tasks) ? (body.tasks as Record<string, unknown>[]) : [];
  for (const task of tasks) {
    if (typeof task?.id !== "string" || !task.id) throw invalid("Tarea inválida.");
    const status =
      typeof task.status === "string"
        ? task.status.trim().toUpperCase()
        : task.isCompleted === true
          ? "COMPLETED"
          : "PENDING";
    if (!TASK_STATUSES.has(status)) throw invalid("Estado de tarea inválido.");
    const completed = status === "COMPLETED";
    await db
      .update(workOrderTasks)
      .set({
        status,
        isCompleted: completed,
        completedAt: completed ? clientTime(task.completedAt) : null,
        observations: optionalText(task.observations, 2000),
      })
      // La tarea debe ser de este equipo.
      .where(and(eq(workOrderTasks.id, task.id), eq(workOrderTasks.workOrderElevatorId, elevatorId)));
  }
  revalidatePanel();
  return "Tareas actualizadas.";
}

export async function saveFindings(
  technicianId: string,
  elevatorId: string,
  body: Record<string, unknown>
) {
  const elevator = await ownedElevator(technicianId, elevatorId);
  if (elevator.workOrderStatus === "COMPLETED") return "La orden ya fue completada.";
  await db
    .update(workOrderElevators)
    .set({ finding: optionalText(body.findings, 2000) })
    .where(eq(workOrderElevators.id, elevatorId));
  revalidatePanel();
  return "Hallazgos guardados.";
}

// ==========================================
// Fotos y audios
// ==========================================

async function fileBytes(file: unknown, maxBytes: number, label: string): Promise<Uint8Array> {
  if (!(file instanceof File)) throw invalid(`No se recibió ${label}.`);
  if (file.size > maxBytes) throw invalid(`${label} supera el tamaño máximo permitido.`);
  return new Uint8Array(await file.arrayBuffer());
}

export async function addPhoto(technicianId: string, elevatorId: string, form: FormData) {
  const elevator = await ownedElevator(technicianId, elevatorId);
  const id = requireUuid(form.get("id"), "La foto");

  const [existing] = await db
    .select({ elevatorId: workOrderElevatorPhotos.workOrderElevatorId })
    .from(workOrderElevatorPhotos)
    .where(eq(workOrderElevatorPhotos.id, id))
    .limit(1);
  if (existing) {
    // Reintento de una subida que ya llegó.
    if (existing.elevatorId === elevatorId) return "La foto ya estaba registrada.";
    throw invalid("Identificador de foto en uso.");
  }
  if (elevator.workOrderStatus === "COMPLETED") throw invalid("La orden ya fue completada.");

  const tag = String(form.get("tag") ?? "").trim().toUpperCase();
  if (!["BEFORE", "AFTER", "POINT"].includes(tag)) throw invalid("Tipo de foto inválido.");

  const taskId = optionalText(form.get("taskId"), 64);
  if (taskId) {
    const [task] = await db
      .select({ elevatorId: workOrderTasks.workOrderElevatorId })
      .from(workOrderTasks)
      .where(eq(workOrderTasks.id, taskId))
      .limit(1);
    if (task?.elevatorId !== elevatorId) throw invalid("La tarea no pertenece a este equipo.");
  }

  // El tipo sale de los bytes reales, no de lo que declare la app.
  const bytes = await fileBytes(form.get("file"), MAX_IMAGE_BYTES, "La foto");
  const validation = validateImageUpload(bytes);
  if (!validation.ok) throw invalid(validation.error);

  const url = await uploadToR2(
    buildElevatorPhotoKey(elevator.workOrderId, elevatorId, validation.image.extension),
    bytes,
    validation.image.contentType
  );
  await db
    .insert(workOrderElevatorPhotos)
    .values({
      id,
      workOrderElevatorId: elevatorId,
      workOrderTaskId: taskId,
      url,
      tag,
      description: optionalText(form.get("description"), 1000),
      createdAt: clientTime(form.get("createdAt")),
    })
    .onConflictDoNothing();
  revalidatePanel();
  return "Foto agregada.";
}

export async function removePhoto(technicianId: string, photoId: string) {
  const [photo] = await db
    .select({
      id: workOrderElevatorPhotos.id,
      url: workOrderElevatorPhotos.url,
      elevatorId: workOrderElevatorPhotos.workOrderElevatorId,
    })
    .from(workOrderElevatorPhotos)
    .where(eq(workOrderElevatorPhotos.id, photoId))
    .limit(1);
  // Ya no existe: el borrado repetido se da por bueno.
  if (!photo) return "La foto ya no existe.";

  const elevator = await ownedElevator(technicianId, photo.elevatorId);
  if (elevator.workOrderStatus === "COMPLETED") throw invalid("La orden ya fue completada.");

  await deleteR2ObjectByUrl(photo.url).catch(() => undefined);
  await db.delete(workOrderElevatorPhotos).where(eq(workOrderElevatorPhotos.id, photo.id));
  revalidatePanel();
  return "Foto eliminada.";
}

/** M4A/MP4: los bytes 4 a 7 del archivo son "ftyp". */
function isM4a(bytes: Uint8Array): boolean {
  return (
    bytes.length > 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  );
}

export async function addAudio(technicianId: string, elevatorId: string, form: FormData) {
  const elevator = await ownedElevator(technicianId, elevatorId);
  const id = requireUuid(form.get("id"), "El audio");

  const [existing] = await db
    .select({ elevatorId: workOrderElevatorAudios.workOrderElevatorId })
    .from(workOrderElevatorAudios)
    .where(eq(workOrderElevatorAudios.id, id))
    .limit(1);
  if (existing) {
    if (existing.elevatorId === elevatorId) return "El audio ya estaba registrado.";
    throw invalid("Identificador de audio en uso.");
  }
  if (elevator.workOrderStatus === "COMPLETED") throw invalid("La orden ya fue completada.");

  const bytes = await fileBytes(form.get("file"), MAX_AUDIO_BYTES, "El audio");
  if (!isM4a(bytes)) throw invalid("Formato de audio no permitido.");

  // 503: la app conserva el audio en el teléfono y lo reintenta más tarde.
  if (!isPrivatePdfStorageConfigured()) {
    throw unavailable("El almacenamiento de audios no está configurado.");
  }
  const short = (value: string) => value.replace(/-/g, "").toLowerCase().slice(0, 12);
  const key = `work-orders/${short(elevator.workOrderId)}/${short(elevatorId)}/audio-${id.toLowerCase()}.m4a`;
  await uploadPrivateObject(key, bytes, "audio/mp4");

  const durationMs = Number(form.get("durationMs"));
  const inserted = await db
    .insert(workOrderElevatorAudios)
    .values({
      id,
      workOrderElevatorId: elevatorId,
      key,
      durationMs: Number.isFinite(durationMs) && durationMs > 0 ? Math.trunc(durationMs) : 0,
      createdAt: clientTime(form.get("createdAt")),
    })
    .onConflictDoNothing()
    .returning({ id: workOrderElevatorAudios.id });
  // Dos subidas simultáneas del mismo audio: la segunda no deja huérfanos.
  if (inserted.length === 0) await deletePrivatePdf(key).catch(() => undefined);
  revalidatePanel();
  return "Audio agregado.";
}

export async function removeAudio(technicianId: string, audioId: string) {
  const id = requireUuid(audioId, "El audio");
  const [audio] = await db
    .select({
      id: workOrderElevatorAudios.id,
      key: workOrderElevatorAudios.key,
      elevatorId: workOrderElevatorAudios.workOrderElevatorId,
    })
    .from(workOrderElevatorAudios)
    .where(eq(workOrderElevatorAudios.id, id))
    .limit(1);
  // Ya no existe: el borrado repetido se da por bueno.
  if (!audio) return "El audio ya no existe.";

  const elevator = await ownedElevator(technicianId, audio.elevatorId);
  if (elevator.workOrderStatus === "COMPLETED") throw invalid("La orden ya fue completada.");

  await db.delete(workOrderElevatorAudios).where(eq(workOrderElevatorAudios.id, audio.id));
  await deletePrivatePdf(audio.key).catch(() => undefined);
  revalidatePanel();
  return "Audio eliminado.";
}

// ==========================================
// Cierre
// ==========================================

export async function completeElevator(
  technicianId: string,
  elevatorId: string,
  body: Record<string, unknown>
) {
  const elevator = await ownedElevator(technicianId, elevatorId);
  if (elevator.status === "COMPLETED") return "El equipo ya estaba finalizado.";

  const mode = body.mode;
  if (mode !== "all_completed" && mode !== "partial") {
    throw invalid("Modo de finalización inválido.");
  }
  const safety = await safetyRecordOf(elevatorId);
  if (safety?.status !== "COMPLETED") {
    throw invalid("Debes completar la seguridad del equipo antes de finalizar el mantenimiento.");
  }
  if (photosRequiredFor(elevator.serviceTypeCode)) {
    const [photos] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workOrderElevatorPhotos)
      .where(eq(workOrderElevatorPhotos.workOrderElevatorId, elevatorId));
    const count = photos?.count ?? 0;
    if (count < MIN_PHOTOS) {
      throw invalid(`Debes subir al menos ${MIN_PHOTOS} fotos. Faltan ${MIN_PHOTOS - count}.`);
    }
  }

  const completedAt = clientTime(body.completedAt);
  if (mode === "all_completed") {
    await db
      .update(workOrderTasks)
      .set({ isCompleted: true, status: "COMPLETED", completedAt })
      .where(and(eq(workOrderTasks.workOrderElevatorId, elevatorId), eq(workOrderTasks.isCompleted, false)));
  }
  await db
    .update(workOrderElevators)
    .set({ status: "COMPLETED", completedAt })
    .where(eq(workOrderElevators.id, elevatorId));
  revalidatePanel();
  return "Equipo finalizado.";
}

function signatureBytes(dataUrl: unknown): Uint8Array {
  const match = typeof dataUrl === "string" ? /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl) : null;
  if (!match) throw invalid("Falta la firma de quien recibe el servicio.");
  const bytes = new Uint8Array(Buffer.from(match[1], "base64"));
  const validation = validateImageUpload(bytes);
  if (!validation.ok || validation.image.extension !== "png") {
    throw invalid("La firma no es una imagen válida.");
  }
  return bytes;
}

export async function completeWorkOrder(
  technicianId: string,
  workOrderId: string,
  body: Record<string, unknown>
) {
  const order = await ownedWorkOrder(technicianId, workOrderId);
  if (order.status === "COMPLETED") return "La orden ya estaba completada.";

  const elevators = await db
    .select({
      id: workOrderElevators.id,
      status: workOrderElevators.status,
      elevatorUnityId: workOrderElevators.elevatorUnityId,
    })
    .from(workOrderElevators)
    .where(eq(workOrderElevators.workOrderId, workOrderId));
  const elevatorIds = elevators.map((elevator) => elevator.id);

  const safetyRows =
    elevatorIds.length > 0
      ? await db
          .select({
            elevatorId: workOrderElevatorSafety.workOrderElevatorId,
            status: workOrderElevatorSafety.status,
          })
          .from(workOrderElevatorSafety)
          .where(inArray(workOrderElevatorSafety.workOrderElevatorId, elevatorIds))
      : [];
  const safetyByElevator = new Map(safetyRows.map((row) => [row.elevatorId, row.status]));
  if (elevators.some((elevator) => safetyByElevator.get(elevator.id) !== "COMPLETED")) {
    throw invalid("Todos los equipos deben tener la seguridad completada antes de finalizar la orden.");
  }
  if (elevators.some((elevator) => elevator.status !== "COMPLETED")) {
    throw invalid("Todos los equipos deben tener su checklist terminado antes de finalizar la orden.");
  }

  const statuses = (body.elevatorStatuses ?? {}) as Record<string, unknown>;
  for (const elevator of elevators) {
    if (typeof statuses[elevator.id] !== "string" || !FINAL_STATUSES.has(statuses[elevator.id] as string)) {
      throw invalid("Debes indicar el estado final de cada equipo.");
    }
  }

  const signatureUrl = await uploadToR2(
    buildSignatureKey(workOrderId),
    signatureBytes(body.signatureDataUrl),
    "image/png"
  );
  const completedAt = clientTime(body.completedAt);
  await db
    .update(workOrders)
    .set({
      status: "COMPLETED",
      completedAt,
      clientSignatureUrl: signatureUrl,
      clientSignerName: optionalText(body.clientName, 150),
    })
    .where(eq(workOrders.id, workOrderId));

  for (const elevator of elevators) {
    const finalStatus = statuses[elevator.id] as string;
    await db
      .update(workOrderElevators)
      .set({ status: "COMPLETED", finalStatus })
      .where(eq(workOrderElevators.id, elevator.id));
    await db
      .update(elevatorUnities)
      .set({ status: finalStatus })
      .where(eq(elevatorUnities.id, elevator.elevatorUnityId));
  }
  revalidatePanel();
  return "Orden completada.";
}
