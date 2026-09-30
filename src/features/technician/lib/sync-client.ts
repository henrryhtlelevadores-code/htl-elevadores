"use client";

import { useSyncExternalStore } from "react";
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  addElevatorPhoto,
  bulkUpdateModuleTasks,
  completeElevator,
  completeElevatorSafety,
  completeWorkOrder,
  removeElevatorPhoto,
  saveSafetyItem,
  startWorkOrder,
  updateElevatorFindings,
  updateWorkOrderTask,
  type ActionState,
} from "../actions";

/**
 * Sincronización offline del flujo del técnico.
 *
 * Cuando una invocación de server action falla por red/offline (lanza
 * excepción), la acción y sus argumentos se guardan en IndexedDB
 * (object store "pending-actions") y se reintentan al recuperar la conexión
 * o en el siguiente intento del técnico. Los errores de validación del
 * servidor llegan como objetos ActionState (success: false) y NO se encolan.
 */

type SyncActions = {
  updateWorkOrderTask: (payload: {
    taskId: string;
    data: Parameters<typeof updateWorkOrderTask>[1];
  }) => Promise<ActionState>;
  bulkUpdateModuleTasks: (
    payload: Parameters<typeof bulkUpdateModuleTasks>[0]
  ) => Promise<ActionState>;
  completeElevator: (payload: Parameters<typeof completeElevator>[0]) => Promise<ActionState>;
  completeElevatorSafety: (
    payload: Parameters<typeof completeElevatorSafety>[0]
  ) => Promise<ActionState>;
  addElevatorPhoto: (payload: Parameters<typeof addElevatorPhoto>[0]) => Promise<ActionState>;
  removeElevatorPhoto: (payload: { photoId: string }) => Promise<ActionState>;
  saveSafetyItem: (payload: {
    itemId: string;
    data: Parameters<typeof saveSafetyItem>[1];
  }) => Promise<ActionState>;
  updateElevatorFindings: (
    payload: Parameters<typeof updateElevatorFindings>[0]
  ) => Promise<ActionState>;
  startWorkOrder: (payload: { workOrderId: string }) => Promise<ActionState>;
  completeWorkOrder: (
    payload: Parameters<typeof completeWorkOrder>[0]
  ) => Promise<ActionState>;
};

const SYNC_ACTIONS: SyncActions = {
  updateWorkOrderTask: (payload) => updateWorkOrderTask(payload.taskId, payload.data),
  bulkUpdateModuleTasks: (payload) => bulkUpdateModuleTasks(payload),
  completeElevator: (payload) => completeElevator(payload),
  completeElevatorSafety: (payload) => completeElevatorSafety(payload),
  addElevatorPhoto: (payload) => addElevatorPhoto(payload),
  removeElevatorPhoto: (payload) => removeElevatorPhoto(payload.photoId),
  saveSafetyItem: (payload) => saveSafetyItem(payload.itemId, payload.data),
  updateElevatorFindings: (payload) => updateElevatorFindings(payload),
  startWorkOrder: (payload) => startWorkOrder(payload.workOrderId),
  completeWorkOrder: (payload) => completeWorkOrder(payload),
};

const DB_NAME = "htl-offline";
const STORE = "pending-actions";

type PendingEntry = {
  id?: number;
  name: keyof SyncActions;
  payload: unknown;
  createdAt: number;
};

interface PendingStoreSchema extends DBSchema {
  "pending-actions": { key: number; value: PendingEntry };
}

let dbPromise: Promise<IDBPDatabase<PendingStoreSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<PendingStoreSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PendingStoreSchema>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export type SyncStatusState = {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
};

const listeners = new Set<(state: SyncStatusState) => void>();

let status: SyncStatusState = {
  online: typeof navigator !== "undefined" ? navigator.onLine : true,
  pendingCount: 0,
  syncing: false,
};

function currentStatus(): SyncStatusState {
  return status;
}

function setStatus(patch: Partial<SyncStatusState>) {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

function setSyncing(value: boolean) {
  setStatus({ syncing: value });
}

async function refreshPendingCount() {
  try {
    const db = await getDB();
    const count = await db.count(STORE);
    setStatus({ pendingCount: count });
  } catch {
    setStatus({ pendingCount: 0 });
  }
}

async function queueAction(name: keyof SyncActions, payload: unknown) {
  const db = await getDB();
  await db.add(STORE, { name, payload, createdAt: Date.now() });
  await refreshPendingCount();
}

/**
 * Procesa la cola. Se detiene ante el primer fallo (red caída o error de
 * validación) para no descartar acciones pendientes.
 */
export async function flushPendingActions(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  try {
    setSyncing(true);
    const db = await getDB();
    const entries = await db.getAll(STORE);
    for (const entry of entries) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      try {
        const run = SYNC_ACTIONS[entry.name] as (payload: never) => Promise<ActionState>;
        const result = await run(entry.payload as never);
        if (!result.success) break;
        if (entry.id !== undefined) {
          await db.delete(STORE, entry.id);
        }
      } catch {
        break;
      }
    }
    await refreshPendingCount();
  } catch {
    setStatus({ pendingCount: 0 });
  } finally {
    setSyncing(false);
  }
}

/** Resultado de una acción técnica; `queued` indica que quedó en la cola offline. */
export type SyncResult = ActionState & { queued?: boolean };

/**
 * Ejecuta una acción técnica. Si la red falla, encola la acción en IndexedDB
 * y devuelve éxito ("queued") para que la UI no revierta cambios optimistas.
 */
export async function runSync<K extends keyof SyncActions>(
  name: K,
  payload: Parameters<SyncActions[K]>[0]
): Promise<SyncResult> {
  try {
    setSyncing(true);
    const result = await SYNC_ACTIONS[name](payload as never);
    if (navigator.onLine && status.pendingCount > 0) {
      void flushPendingActions();
    }
    return result;
  } catch (error) {
    try {
      await queueAction(name, payload);
    } catch {
      // IndexedDB no disponible: se pierde el cambio, se informa al técnico.
      return {
        success: false,
        error:
          error instanceof Error
            ? `Sin conexión y sin almacenamiento local: ${error.message}`
            : "Sin conexión y sin almacenamiento local.",
      };
    }
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void flushPendingActions();
    }
    return {
      success: true,
      queued: true,
      message: "Sin conexión. Cambio guardado, se sincronizará automáticamente.",
    };
  } finally {
    setSyncing(false);
  }
}

function subscribeSync(listener: (state: SyncStatusState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncStatus(): SyncStatusState {
  return useSyncExternalStore(subscribeSync, currentStatus, currentStatus);
}

if (typeof window !== "undefined") {
  window.addEventListener("offline", () => {
    setStatus({ online: false });
  });
  window.addEventListener("online", () => {
    setStatus({ online: true });
    void flushPendingActions();
  });
  void refreshPendingCount();
  if (navigator.onLine) {
    void flushPendingActions();
  }
}