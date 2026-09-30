"use client";

import { useCallback, useState } from "react";
import { type WorkOrderWithRelations, type WorkOrderElevatorWithRelations, type WorkOrderTaskWithRelations, type ServiceTypeOption } from "../actions";
import { getWorkOrderTasks, updateWorkOrder, toggleWorkOrderTask, createWorkOrderTask, deleteWorkOrderTask, deleteWorkOrder } from "../actions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
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
  ChevronDown,
  ChevronLeft,
  MapPin,
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ scheduledDate: workOrder.scheduledDate ?? "", scheduledTime: workOrder.scheduledTime ?? "", priority: workOrder.priority ?? "NORMAL", technicianId: workOrder.technicianId ?? "", description: workOrder.description ?? "", supportingTechnicians: workOrder.supportingTechnicians ?? "", estimatedDurationMins: workOrder.estimatedDurationMins ?? null });
  const [newTask, setNewTask] = useState("");
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const typeLabel =
    serviceTypes.find((s) => s.id === (workOrder.serviceTypeId ?? ""))?.name ??
    LEGACY_TYPE_LABELS[workOrder.serviceTypeId ?? ""] ??
    (workOrder.serviceTypeId ? "Servicio no encontrado" : "Sin tipo de servicio");
  const priorityLabel =
    PRIORITY_LABELS[workOrder.priority ?? ""] ?? (workOrder.priority ?? "—");
  const isPreventive = serviceTypes.find((s) => s.id === workOrder.serviceTypeId)?.code === "PREV";
  const canDelete = workOrder.status === "PENDING";

  const loadTasks = useCallback((elevatorId: string) => {
    if (tasksActiveId === elevatorId) {
      setTasksActiveId(null);
      setTasks([]);
      return;
    }
    setTasksActiveId(elevatorId);
    void getWorkOrderTasks(elevatorId).then(setTasks);
  }, [tasksActiveId]);

  return (
    <>
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card border-border sm:max-w-[900px] text-foreground shadow-lg max-h-[92dvh] overflow-y-auto"
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
          <div className="flex flex-wrap justify-end gap-2">
            {canDelete && <Button size="sm" variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>Eliminar OT</Button>}
            {!editing ? <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button> : <>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button size="sm" onClick={async () => { const result = await updateWorkOrder(workOrder.id, { ...draft, priority: draft.priority as "LOW" | "NORMAL" | "HIGH" | "EMERGENCY" }); if (result.success) { setEditing(false); onClose(); } }}>Guardar</Button>
            </>}
          </div>
        </DialogHeader>

          {editing && <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
          <label className="space-y-1 text-xs font-semibold">Fecha de inicio<DatePicker value={draft.scheduledDate} onChange={(value) => setDraft({ ...draft, scheduledDate: value })} /></label>
          <label className="space-y-1 text-xs font-semibold">Hora de inicio<TimePicker value={draft.scheduledTime} onChange={(value) => setDraft({ ...draft, scheduledTime: value })} /></label>
          <label className="space-y-1 text-xs font-semibold">Prioridad<select className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}><option value="LOW">Baja</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="EMERGENCY">Emergencia</option></select></label>
          <label className="space-y-1 text-xs font-semibold">Duración por equipo (min)<Input type="number" min="1" value={draft.estimatedDurationMins ?? ""} onChange={(e) => setDraft({ ...draft, estimatedDurationMins: e.target.value ? Number(e.target.value) : null })} /></label>
          <label className="col-span-2 space-y-1 text-xs font-semibold">Técnicos de apoyo<Input value={draft.supportingTechnicians} onChange={(e) => setDraft({ ...draft, supportingTechnicians: e.target.value })} placeholder="Texto libre" /></label>
          {!isPreventive && <label className="col-span-2 space-y-1 text-xs font-semibold">Descripción del problema<Textarea className="text-xs" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Descripción del problema" /></label>}
          </div>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {[
            ["Tipo", typeLabel],
            ["Prioridad", priorityLabel],
            ["Programada", formatDate(workOrder.scheduledDate ?? null, workOrder.scheduledTime ?? null)],
            ["Duración", workOrder.estimatedDurationMins ? `${workOrder.estimatedDurationMins} min/equipo` : "—"],
            ["Fin estimado", workOrder.estimatedEndAt ? formatDateTime(workOrder.estimatedEndAt) : "—"],
            ["Estado", (workOrder.status ?? "").replace("_", " ")],
          ].map(([label, value]) => (
            <div key={String(label)} className="min-w-0 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="text-sm font-bold break-words">{value}</div>
            </div>
          ))}
        </div>

        {workOrder.description && <details open className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-xs font-semibold">Descripción del problema</summary><p className="mt-2 text-xs whitespace-pre-wrap">{workOrder.description}</p></details>}

        {/* Listado read-only de equipos de la OT */}
        {workOrderElevators.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-10 text-center">
            <Cpu className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground font-semibold">
              No hay equipos asignados a esta OT
            </p>
          </div>
        ) : (
          <details open className="space-y-2">
            <summary className="mb-2 cursor-pointer text-xs font-semibold">Equipos afectados ({workOrderElevators.length})</summary>
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
                       title={isOpen ? "Cerrar tareas" : "Ver y gestionar tareas de este equipo"}
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

                   {!isOpen && <p className="border-t border-border px-3 py-2 text-[11px] text-[#0066CC]">Haz clic en el icono de búsqueda para ver y agregar las tareas de este equipo.</p>}

                   {/* Tareas del equipo */}
                  {isOpen && (
                    <div className="border-t border-border bg-muted/30 px-3 py-3 space-y-2">
                      {tasks.length === 0 ? (
                        <p className="text-center text-[11px] text-muted-foreground py-2">
                          Sin tareas registradas para este equipo.
                        </p>
                      ) : isPreventive ? (
                        /* Preventivo: tareas agrupadas por módulo */
                        (() => {
                          const groups = new Map<string, WorkOrderTaskWithRelations[]>();
                          for (const task of tasks) {
                            const key = task.moduleId ?? "__NONE__";
                            if (!groups.has(key)) groups.set(key, []);
                            groups.get(key)!.push(task);
                          }
                          return (
                            <ul className="space-y-2">
                              {[...groups.entries()].map(([key, groupTasks]) => {
                                const groupKey = `${elevator.id}::${key}`;
                                const isModuleOpen = openModules[groupKey] ?? false;
                                const doneCount = groupTasks.filter(
                                  (t) => t.isCompleted
                                ).length;
                                return (
                                  <li key={key} className="space-y-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenModules((prev) => ({
                                          ...prev,
                                          [groupKey]: !(prev[groupKey] ?? false),
                                        }))
                                      }
                                      className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left"
                                    >
                                      <span className="inline-flex items-center rounded border border-[#0066CC]/30 bg-[#0066CC]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#0066CC] dark:text-[#4d9aff]">
                                        {groupTasks[0]?.module_code ?? "Sin módulo"}
                                      </span>
                                      <span className="flex-1 min-w-0 truncate text-[10px] font-semibold text-muted-foreground">
                                        {groupTasks[0]?.module_name}
                                      </span>
                                      <span className="text-[10px] font-mono text-muted-foreground/60">
                                        {doneCount}/{groupTasks.length}
                                      </span>
                                      <ChevronDown
                                        className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                                          isModuleOpen ? "rotate-180" : ""
                                        }`}
                                      />
                                    </button>
                                    {isModuleOpen && (
                                      <ul className="space-y-1">
                                        {groupTasks.map((task) => (
                                          <li
                                            key={task.id}
                                            className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
                                          >
                                            <Checkbox checked={!!task.isCompleted} onCheckedChange={async (checked) => { await toggleWorkOrderTask(task.id, checked === true); setTasks((current) => current.map((t) => t.id === task.id ? { ...t, isCompleted: checked === true } : t)); }} />
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
                                  </li>
                                );
                              })}
                            </ul>
                          );
                        })()
                      ) : (
                        /* Correctivo: lista plana */
                        <ul className="space-y-1">
                          {tasks.map((task) => (
                            <li
                              key={task.id}
                              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
                            >
                              <Checkbox checked={!!task.isCompleted} onCheckedChange={async (checked) => { await toggleWorkOrderTask(task.id, checked === true); setTasks((current) => current.map((t) => t.id === task.id ? { ...t, isCompleted: checked === true } : t)); }} />
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
                              {!isPreventive && <Button variant="ghost" size="icon-xs" onClick={async () => { await deleteWorkOrderTask(task.id); setTasks((current) => current.filter((t) => t.id !== task.id)); }}>×</Button>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!isPreventive && isOpen && <div className="flex gap-2 pt-2"><Input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Nueva tarea" className="text-xs" /><Button size="sm" onClick={async () => { if (!newTask.trim()) return; const result = await createWorkOrderTask({ workOrderElevatorId: elevator.id, taskDescription: newTask, isCritical: false, requiresPhoto: false, observations: "" }); if (result.success) { setNewTask(""); getWorkOrderTasks(elevator.id).then(setTasks); } }}>+ Agregar tarea</Button></div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          </details>
        )}

        <details open className="rounded-xl border border-border p-3">
          <summary className="cursor-pointer text-xs font-semibold">Técnicos de apoyo</summary>
          <p className="mt-2 text-xs text-muted-foreground">{workOrder.supportingTechnicians || "Ninguno"}</p>
        </details>
      </DialogContent>
    </Dialog>

    <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>¿Eliminar {workOrder.otNumber}?</DialogTitle>
          <DialogDescription>
            {isPreventive
              ? "Esta OT preventiva y todas sus tareas asociadas serán eliminadas. Esta acción no se puede deshacer."
              : "La OT pendiente será eliminada. Esta acción no se puede deshacer."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={async () => { const result = await deleteWorkOrder(workOrder.id); if (result.success) { setDeleteConfirmOpen(false); onClose(); } }}>Eliminar OT</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
