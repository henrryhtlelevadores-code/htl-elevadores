"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { WorkOrderServiceTask } from "@/db";
import {
  createWorkOrderServiceTask,
  deleteWorkOrderServiceTask,
  toggleWorkOrderServiceTask,
  updateWorkOrderServiceStatus,
  type WorkOrderServiceWithRelations,
} from "../services-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MapPin, Sparkles } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En curso" },
  { value: "COMPLETED", label: "Completado" },
];

const nowSeconds = () => Math.floor(Date.now() / 1000);

const formatDateTime = (unixSeconds: number) =>
  new Date(unixSeconds * 1000).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Servicios generales de la OT en su detalle: estado y tareas de cada uno. */
export function WorkOrderServicesSection({
  services: initialServices,
  locked,
}: {
  services: WorkOrderServiceWithRelations[];
  /** OT aprobada: solo lectura. */
  locked: boolean;
}) {
  const [services, setServices] = useState(initialServices);
  const [newTasks, setNewTasks] = useState<Record<string, string>>({});

  function patchService(
    serviceId: string,
    change: (service: WorkOrderServiceWithRelations) => WorkOrderServiceWithRelations
  ) {
    setServices((current) => current.map((s) => (s.id === serviceId ? change(s) : s)));
  }

  const patchTasks = (
    serviceId: string,
    change: (tasks: WorkOrderServiceTask[]) => WorkOrderServiceTask[]
  ) => patchService(serviceId, (service) => ({ ...service, tasks: change(service.tasks) }));

  async function changeStatus(service: WorkOrderServiceWithRelations, status: string) {
    const result = await updateWorkOrderServiceStatus(service.id, status);
    if (!result.success) {
      toast.error("No se pudo actualizar", { description: result.error });
      return;
    }
    const now = nowSeconds();
    patchService(service.id, (s) => ({
      ...s,
      status,
      startedAt: status === "PENDING" ? null : (s.startedAt ?? now),
      completedAt: status === "COMPLETED" ? now : null,
    }));
  }

  async function toggleTask(serviceId: string, task: WorkOrderServiceTask, isCompleted: boolean) {
    const result = await toggleWorkOrderServiceTask(task.id, isCompleted);
    if (!result.success) {
      toast.error("No se pudo actualizar", { description: result.error });
      return;
    }
    patchTasks(serviceId, (tasks) =>
      tasks.map((t) => (t.id === task.id ? { ...t, isCompleted } : t))
    );
  }

  async function addTask(serviceId: string) {
    const description = (newTasks[serviceId] ?? "").trim();
    if (!description) return;
    const result = await createWorkOrderServiceTask(serviceId, description);
    if (!result.success || !("id" in result) || !result.id) {
      toast.error("No se pudo agregar", { description: "error" in result ? result.error : undefined });
      return;
    }
    const task: WorkOrderServiceTask = {
      id: result.id,
      workOrderServiceId: serviceId,
      taskDescription: description,
      isCritical: false,
      isCompleted: false,
      status: "PENDING",
      requiresPhoto: false,
      observations: null,
      evidencePhotoUrl: null,
      completedAt: null,
      orderIndex: 0,
    };
    patchTasks(serviceId, (tasks) => [...tasks, task]);
    setNewTasks((current) => ({ ...current, [serviceId]: "" }));
  }

  async function removeTask(serviceId: string, taskId: string) {
    const result = await deleteWorkOrderServiceTask(taskId);
    if (!result.success) {
      toast.error("No se pudo eliminar", { description: result.error });
      return;
    }
    patchTasks(serviceId, (tasks) => tasks.filter((t) => t.id !== taskId));
  }

  return (
    <details open className="space-y-2 px-4 pt-1">
      <summary className="mb-2 cursor-pointer text-xs font-semibold">
        Servicios a realizar ({services.length})
      </summary>
      <div className="space-y-3">
        {services.map((service, index) => {
          const status = service.status ?? "PENDING";
          const done = service.tasks.filter((t) => t.isCompleted).length;
          return (
            <div key={service.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-start gap-2 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-violet-500/10 text-xs font-bold text-violet-600 dark:text-violet-400">
                  {index + 1}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-1.5 pt-0.5">
                  <Sparkles className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400" />
                  <span className="min-w-0 break-words text-sm font-semibold leading-tight">
                    {service.service_type_name ?? "Servicio general"}
                  </span>
                </div>
                {locked ? (
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
                    }`}
                  >
                    {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
                  </span>
                ) : (
                  <select
                    aria-label="Estado del servicio"
                    value={status}
                    onChange={(event) => void changeStatus(service, event.target.value)}
                    className={`h-7 shrink-0 rounded-full border px-2 text-[10px] font-bold ${
                      STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
                    }`}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Ubicación y descripción bajo la cabecera: usan todo el ancho en móvil. */}
              {(service.locationDescription || service.description) && (
                <div className="space-y-1 px-3 pb-3">
                  {service.locationDescription && (
                    <p className="flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 size-3 shrink-0" />
                      <span className="min-w-0 break-words">{service.locationDescription}</span>
                    </p>
                  )}
                  {service.description && (
                    <p className="whitespace-pre-wrap break-words text-xs">{service.description}</p>
                  )}
                </div>
              )}

              {(service.startedAt || service.completedAt) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                  <span>
                    Inicio:{" "}
                    <span className="font-medium text-foreground">
                      {service.startedAt ? formatDateTime(service.startedAt) : "—"}
                    </span>
                  </span>
                  <span>
                    Fin:{" "}
                    <span className="font-medium text-foreground">
                      {service.completedAt ? formatDateTime(service.completedAt) : "—"}
                    </span>
                  </span>
                </div>
              )}

              {service.observations && (
                <div className="border-t border-border px-3 py-2">
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Observaciones
                  </div>
                  <p className="whitespace-pre-wrap text-xs text-foreground/80">{service.observations}</p>
                </div>
              )}

              <div className="border-t border-border bg-muted/10">
                <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-2">
                  <span className="text-xs font-medium uppercase text-muted-foreground">Tareas</span>
                  <span className="text-xs font-semibold">
                    {done}/{service.tasks.length}
                  </span>
                </div>
                <div className="space-y-2 px-3 py-3">
                  {service.tasks.length === 0 ? (
                    <p className="py-1 text-center text-[11px] text-muted-foreground">
                      Sin tareas registradas para este servicio.
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {service.tasks.map((task) => (
                        <li
                          key={task.id}
                          className="flex items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2.5"
                        >
                          <Checkbox
                            checked={!!task.isCompleted}
                            disabled={locked}
                            onCheckedChange={(checked) =>
                              void toggleTask(service.id, task, checked === true)
                            }
                          />
                          <p
                            className={`min-w-0 flex-1 break-words text-sm leading-snug ${
                              task.isCompleted ? "text-muted-foreground/60 line-through" : "text-foreground"
                            }`}
                          >
                            {task.taskDescription}
                          </p>
                          {!locked && (
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              aria-label="Eliminar tarea"
                              onClick={() => void removeTask(service.id, task.id)}
                            >
                              ×
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!locked && (
                    <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                      <Input
                        value={newTasks[service.id] ?? ""}
                        onChange={(event) =>
                          setNewTasks((current) => ({ ...current, [service.id]: event.target.value }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void addTask(service.id);
                          }
                        }}
                        placeholder="Nueva tarea"
                        className="min-h-11 text-xs"
                      />
                      <Button
                        size="sm"
                        className="min-h-11 w-full sm:w-auto"
                        onClick={() => void addTask(service.id)}
                      >
                        + Agregar tarea
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
