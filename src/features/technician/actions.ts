"use server";

import { revalidatePath } from "next/cache";
import { eq, and, isNull, inArray, or } from "drizzle-orm";
import {
  db,
  workOrders,
  workOrderElevators,
  elevatorUnities,
  safetyTemplates,
  workOrderSafetyRecords,
} from "@/db/index";
import { getSessionUserId } from "@/features/auth/server";
import {
  buildEvidenceKey,
  buildSignatureKey,
  uploadToR2,
} from "@/lib/r2";
import { generateUuid } from "@/lib/uuid";

const MAX_EVIDENCE_PER_ELEVATOR = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB (dataUrl decodificada)

interface ActionState {
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

function parseChecklistItems(content: unknown): unknown[] {
  let current: unknown = content;
  // El contenido puede venir como texto, o texto JSON de texto JSON (doble
  // codificación al guardarse desde el formulario de administración).
  for (let depth = 0; depth < 3; depth++) {
    if (Array.isArray(current)) return current;
    if (typeof current !== "string") return [];
    try {
      current = JSON.parse(current);
    } catch {
      return [];
    }
  }
  return Array.isArray(current) ? current : [];
}

function buildSafetyResponses(content: unknown): Array<{
  id: string;
  label: string;
  isCritical: boolean;
  completed: boolean;
}> {
  return parseChecklistItems(content).map((item) => {
    const it = (item ?? {}) as {
      id?: string;
      label?: string;
      isCritical?: boolean;
    };
    return {
      id: it.id ?? generateUuid(),
      label: it.label ?? "",
      isCritical: !!it.isCritical,
      completed: true,
    };
  });
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
async function ensureSafetyRecords(
  workOrderId: string,
  technicianId: string
): Promise<void> {
  const elevators = await db
    .select({ equipmentTypeId: elevatorUnities.elevatorTypeId })
    .from(workOrderElevators)
    .innerJoin(elevatorUnities, eq(workOrderElevators.elevatorUnityId, elevatorUnities.id))
    .where(eq(workOrderElevators.workOrderId, workOrderId));

  const typeIds = Array.from(
    new Set(
      elevators
        .map((e) => e.equipmentTypeId)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    )
  );

  const existing = await db
    .select({ templateId: workOrderSafetyRecords.templateId })
    .from(workOrderSafetyRecords)
    .where(eq(workOrderSafetyRecords.workOrderId, workOrderId));
  const recorded = new Set(existing.map((r) => r.templateId));

  const templates = await db
    .select()
    .from(safetyTemplates)
    .where(
      and(
        eq(safetyTemplates.isActive, true),
        typeIds.length > 0
          ? or(
              inArray(safetyTemplates.equipmentTypeId, typeIds),
              isNull(safetyTemplates.equipmentTypeId)
            )
          : isNull(safetyTemplates.equipmentTypeId)
      )
    );

  const pending = templates.filter((t) => !recorded.has(t.id));
  if (pending.length === 0) return;

  const now = Date.now();
  await db.insert(workOrderSafetyRecords).values(
    pending.map((t) => ({
      id: generateUuid(),
      workOrderId,
      templateId: t.id,
      technicianId,
      status: "COMPLETED",
      responses: buildSafetyResponses(t.content),
      signedAt: now,
    }))
  );
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
      await ensureSafetyRecords(workOrderId, session.technicianId);
      await setEquipmentInMaintenance(workOrderId);
      return { success: true, message: "La orden ya estaba en curso." };
    }

    await db
      .update(workOrders)
      .set({ status: "IN_PROGRESS", startedAt: Date.now() })
      .where(eq(workOrders.id, workOrderId));

    await ensureSafetyRecords(workOrderId, session.technicianId);
    await setEquipmentInMaintenance(workOrderId);

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

export async function saveElevatorFindings(
  elevatorId: string,
  finding: string
): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    await getElevatorWorkOrderByTechnician(session.technicianId, elevatorId);

    const clean = finding.trim().slice(0, 2000);
    await db
      .update(workOrderElevators)
      .set({ finding: clean || null })
      .where(eq(workOrderElevators.id, elevatorId));

    revalidateTechnicianUrls();
    return { success: true, message: clean ? "Hallazgos guardados." : "Hallazgos eliminados." };
  } catch (error) {
    console.error("saveElevatorFindings:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al guardar hallazgos.",
    };
  }
}

export async function addElevatorEvidence(
  elevatorId: string,
  images: Array<{ dataUrl: string; contentType: string }>
): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    if (!images || images.length === 0) {
      return { success: false, error: "No se recibieron imágenes." };
    }

    const rel = await getElevatorWorkOrderByTechnician(session.technicianId, elevatorId);

    const existing = await db
      .select({ evidencePhotoUrls: workOrderElevators.evidencePhotoUrls })
      .from(workOrderElevators)
      .where(eq(workOrderElevators.id, elevatorId))
      .limit(1);
    const urls: string[] = ((existing[0]?.evidencePhotoUrls as string[] | null) ?? []).filter(
      (u): u is string => typeof u === "string" && u.length > 0
    );

    const remaining = MAX_EVIDENCE_PER_ELEVATOR - urls.length;
    if (remaining <= 0) {
      return {
        success: false,
        message: `Límite de ${MAX_EVIDENCE_PER_ELEVATOR} fotos por equipo alcanzado.`,
      };
    }

    const uploads = images.slice(0, remaining);
    const uploadedUrls: string[] = [];
    for (let i = 0; i < uploads.length; i++) {
      const { dataUrl, contentType } = uploads[i];
      const ext = contentType === "image/png" ? "png" : "jpg";
      const bytes = decodeDataUrl(dataUrl);
      const key = buildEvidenceKey(rel.workOrderId, elevatorId, urls.length + i + 1, ext);
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

    revalidateTechnicianUrls();
    return {
      success: true,
      message: `${uploadedUrls.length} foto(s) subida(s).`,
    };
  } catch (error) {
    console.error("addElevatorEvidence:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error al subir las fotos.",
    };
  }
}

export type ElevatorFinalStatus = "OPERATIVE" | "OUT_OF_SERVICE";

export async function removeElevatorEvidence(
  elevatorId: string,
  url: string
): Promise<ActionState> {
  try {
    const session = await requireTechnician();
    if (!session.success || !session.technicianId) return session;

    if (!url) {
      return { success: false, error: "URL de imagen inválida." };
    }

    await getElevatorWorkOrderByTechnician(session.technicianId, elevatorId);

    const existing = await db
      .select({ evidencePhotoUrls: workOrderElevators.evidencePhotoUrls })
      .from(workOrderElevators)
      .where(eq(workOrderElevators.id, elevatorId))
      .limit(1);
    const urls: string[] = ((existing[0]?.evidencePhotoUrls as string[] | null) ?? []).filter(
      (u): u is string => typeof u === "string" && u.length > 0
    );

    const next = urls.filter((u) => u !== url);
    if (next.length === urls.length) {
      return { success: false, error: "La foto no existe en este equipo." };
    }

    await db
      .update(workOrderElevators)
      .set({ evidencePhotoUrls: next })
      .where(eq(workOrderElevators.id, elevatorId));

    revalidateTechnicianUrls();
    return { success: true, message: "Foto eliminada." };
  } catch (error) {
    console.error("removeElevatorEvidence:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error al eliminar la foto.",
    };
  }
}

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
        elevatorUnityId: workOrderElevators.elevatorUnityId,
      })
      .from(workOrderElevators)
      .where(eq(workOrderElevators.workOrderId, workOrderId));

    const allowed = new Set<string>(["OPERATIVE", "OUT_OF_SERVICE"]);
    const finalStatuses = new Map<string, ElevatorFinalStatus>();
    for (const elevator of elevators) {
      const value = (elevatorStatuses ?? {})[elevator.id];
      if (!allowed.has(value)) {
        return {
          success: false,
          error:
            "Debes indicar el estado final de cada equipo (Operativo o Fuera de Servicio).",
        };
      }
      finalStatuses.set(elevator.id, value as ElevatorFinalStatus);
    }

    await ensureSafetyRecords(workOrderId, session.technicianId);

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