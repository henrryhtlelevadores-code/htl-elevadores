"use client";

import { useCallback, useState } from "react";
import { type WorkOrderWithRelations, type WorkOrderElevatorWithRelations, type WorkOrderTaskWithRelations, type ServiceTypeOption } from "../actions";
import { getWorkOrderTasks } from "../actions";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Cpu,
  ChevronLeft,
  MapPin,
  CheckCircle2,
  Circle,
  Search,
  X,
} from "lucide-react";

interface WorkOrderDetailProps {
  workOrder: WorkOrderWithRelations;
  workOrderElevators: WorkOrderElevatorWithRelations[];
  serviceTypes: ServiceTypeOption[];
  onClose: () => void;
}

const ELEVATOR_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "Alta",
  NORMAL: "Normal",
  LOW: "Baja",
};

const LEGACY_TYPE_LABELS: Record<string, string> = {
  CORRECTIVE: "Correctivo",
  PREVENTIVE: "Preventivo",
  PREDICTIVE: "Predictivo",
  INSTALLATION: "Instalación",
};

function formatDate(date: string | null, time?: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return time ? `${base} · ${time}` : base;
}

function toMillis(value: number): number {
  // Tolera timestamps en segundos y en milisegundos.
  return value < 1e11 ? value * 1000 : value;
}

function formatDateTime(unixSeconds: number): string {
  return new Date(toMillis(unixSeconds)).toLocaleString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function WorkOrderDetail({
  workOrder,
  workOrderElevators,
  serviceTypes,
  onClose,
}: WorkOrderDetailProps) {
  const [tasksActiveId, setTasksActiveId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<WorkOrderTaskWithRelations[]>([]);

  const typeLabel =
    serviceTypes.find((s) => s.id === (workOrder.type ?? ""))?.name ??
    LEGACY_TYPE_LABELS[workOrder.type ?? ""] ??
    (workOrder.type ?? "—");
  const priorityLabel =
    PRIORITY_LABELS[workOrder.priority ?? ""] ?? (workOrder.priority ?? "—");

  const loadTasks = useCallback((elevatorId: string) => {
    setTasksActiveId((prev) => {
      const next = prev === elevatorId ? null : elevatorId;
      if (next) {
        getWorkOrderTasks(elevatorId).then((res) => {
          setTasks(res);
        });
      } else {
        setTasks([]);
      }
      return next;
    });
  }, []);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card border-border sm:max-w-[760px] text-foreground shadow-lg max-h-[92vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 bg-card"
        >
          <ChevronLeft className="size-3" />
          Cerrar
        </button>

        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <ClipboardList className="size-4 text-[#0066CC]" />
            {workOrder.otNumber}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {workOrder.client_name} — {workOrder.cost_center_name}
            {workOrder.technician_name ? ` — Técnico: ${workOrder.technician_name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {[
            ["Tipo", typeLabel],
            ["Prioridad", priorityLabel],
            ["Programada", formatDate(workOrder.scheduledDate ?? null, workOrder.scheduledTime ?? null)],
            ["Estado", (workOrder.status ?? "").replace("_", " ")],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="text-xs font-bold truncate">{value}</div>
            </div>
          ))}
        </div>

        {/* Listado read-only de equipos de la OT */}
        {workOrderElevators.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center">
            <Cpu className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground font-semibold">
              No hay equipos asignados a esta OT
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {workOrderElevators.map((elevator) => {
              const isOpen = tasksActiveId === elevator.id;
              const completedCount = tasks.filter((t) => t.isCompleted).length;
              return (
                <div key={elevator.id} className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => loadTasks(elevator.id)}
                      className="shrink-0 text-muted-foreground hover:bg-muted"
                      title={isOpen ? "Cerrar checklist" : "Ver checklist"}
                    >
                      {isOpen ? <X className="size-3.5" /> : <Search className="size-3.5" />}
                    </Button>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border border-border">
                      {elevator.internal_code}
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Cpu className="size-3.5 text-[#0066CC] shrink-0" />
                      <span className="text-xs font-semibold truncate">{elevator.elevator_name}</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
                      <MapPin className="size-3" />
                      <span className="truncate max-w-[150px]">{elevator.cost_center_name}</span>
                    </div>
                    {isOpen && tasks.length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {completedCount}/{tasks.length}
                      </span>
                    )}
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                        ELEVATOR_STATUS_STYLES[elevator.status || "PENDING"] || ELEVATOR_STATUS_STYLES.PENDING
                      }`}
                    >
                      {(elevator.status || "PENDING").replace("_", " ")}
                    </span>
                  </div>

                  {/* Tiempos reales de ejecución por equipo */}
                  {(elevator.startedAt || elevator.completedAt) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                      <span>
                        Inicio real:{" "}
                        <span className="font-medium text-foreground">
                          {elevator.startedAt ? formatDateTime(elevator.startedAt) : "—"}
                        </span>
                      </span>
                      <span>
                        Fin real:{" "}
                        <span className="font-medium text-foreground">
                          {elevator.completedAt ? formatDateTime(elevator.completedAt) : "—"}
                        </span>
                      </span>
                      <span>
                        Duración:{" "}
                        <span className="font-medium text-foreground">
                          {elevator.startedAt && elevator.completedAt
                            ? formatDuration(
                                (toMillis(elevator.completedAt) - toMillis(elevator.startedAt)) / 1000
                              )
                            : "—"}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Hallazgos (solo lectura) */}
                  {elevator.finding ? (
                    <div className="px-3 pb-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
                        Hallazgos
                      </div>
                      <p className="text-xs text-foreground/80 whitespace-pre-wrap rounded-md bg-muted/40 border border-border px-2.5 py-2">
                        {elevator.finding}
                      </p>
                    </div>
                  ) : null}

                  {/* Checklist (solo lectura) */}
                  {isOpen && (
                    <div className="border-t border-border bg-muted/30 px-3 py-3 space-y-2">
                      {tasks.length === 0 ? (
                        <p className="text-center text-[11px] text-muted-foreground py-2">
                          Sin tareas registradas para este equipo.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {tasks.map((task) => (
                            <li
                              key={task.id}
                              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
                            >
                              {task.isCompleted ? (
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                              ) : (
                                <Circle className="size-4 text-muted-foreground shrink-0" />
                              )}
                              <span
                                className={`text-xs flex-1 ${
                                  task.isCompleted
                                    ? "line-through text-muted-foreground/60"
                                    : "text-foreground"
                                }`}
                              >
                                {task.taskDescription}
                                {task.isCritical && (
                                  <span className="ml-1.5 text-[9px] font-bold uppercase text-red-500 border border-red-500/30 rounded px-1 py-0.5 bg-red-500/10">
                                    Crítica
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}