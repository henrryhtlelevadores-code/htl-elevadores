"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteMaintenanceTask,
  reorderMaintenanceTasks,
  type MaintenanceModuleWithCount,
  type MaintenanceTaskWithModule,
} from "../actions";
import {
  frequencyPerYearLabel,
  type MaintenanceZone,
} from "../constants";
import { TaskFormDialog } from "./task-form-dialog";
import { TaskBatchDialog } from "./task-batch-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Camera,
  ClipboardList,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";

/** Estado del arrastre por zona: { zona, indiceDestino }. */
type DragState = { zone: MaintenanceZone; overIndex: number } | null;

interface ModuleTasksViewProps {
  module: MaintenanceModuleWithCount;
  initialTasks: MaintenanceTaskWithModule[];
  zones: Array<{ id: string; name: string; orderIndex: number }>;
}

export function ModuleTasksView({ module, initialTasks, zones }: ModuleTasksViewProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTaskWithModule | null>(null);
  const [formZone, setFormZone] = useState<MaintenanceZone>(zones[0]?.id ?? "");
  const [deletingTask, setDeletingTask] = useState<MaintenanceTaskWithModule | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [isPending, startTransition] = useTransition();

  // Agrupar por zona conservando el orden por order_index.
  const grouped = useMemo(() => {
    const map = new Map<string, MaintenanceTaskWithModule[]>();
    for (const task of initialTasks) {
      const list = map.get(task.zoneId ?? "") ?? [];
      list.push(task);
      map.set(task.zoneId ?? "", list);
    }
    return map;
  }, [initialTasks]);

  const zoneTaskCounts = useMemo(
    () => Object.fromEntries(
      [...grouped.entries()].map(([zone, tasks]) => [zone, tasks.length])
    ) as Partial<Record<MaintenanceZone, number>>,
    [grouped]
  );

  function openCreate(zone: MaintenanceZone) {
    setEditingTask(null);
    setFormZone(zone);
    setIsFormOpen(true);
  }

  function openEdit(task: MaintenanceTaskWithModule) {
    setEditingTask(task);
    setFormZone(task.zoneId ?? zones[0]?.id ?? "");
    setIsFormOpen(true);
  }

  function handleDelete() {
    if (!deletingTask) return;
    startTransition(async () => {
      const res = await deleteMaintenanceTask(deletingTask.id);
      if (res.success) {
        toast.success(res.message);
        setDeletingTask(null);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  /** Reordena dentro de la zona y persiste la numeración 1..N. */
  function commitReorder(zone: MaintenanceZone, from: number, to: number) {
    const list = grouped.get(zone);
    if (!list || from === to) return;

    const ids = list.map((t) => t.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);

    startTransition(async () => {
      const res = await reorderMaintenanceTasks(module.id, zone, ids);
      if (res.success) {
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-5">
      <Link
        href="/configuracion/mantenimiento/modulos"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Módulos de Mantenimiento
      </Link>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs">
              {module.code}
            </span>
            {module.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Frecuencia: {frequencyPerYearLabel(module.frequencyPerYear)}</span>
            <span aria-hidden>·</span>
            <span>Tareas: {initialTasks.length}</span>
            <span aria-hidden>·</span>
            <span className={module.isActive ? "" : "text-muted-foreground/70"}>
              Estado: {module.isActive ? "Activo" : "Inactivo"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => setIsBatchOpen(true)}
            className="border-border text-xs font-semibold h-9 px-3 gap-2"
          >
            <ClipboardList className="size-4" />
            Por Lotes
          </Button>
          <Button
            onClick={() => openCreate(zones[0]?.id ?? "")}
            className="bg-[#0066CC] hover:bg-[#0055AA] text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs"
          >
            <Plus className="size-4" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {grouped.size === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
          <p className="text-xs text-muted-foreground">
            Este módulo todavía no tiene tareas. Crea la primera para empezar.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {zones.filter((zone) => grouped.has(zone.id)).map((zone) => {
            const tasks = grouped.get(zone.id) ?? [];
            const overIndex = drag?.zone === zone.id ? drag.overIndex : null;
            return (
              <section
                key={zone.id}
                className="rounded-xl border border-border bg-card shadow-xs overflow-hidden"
              >
                <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-foreground/80">
                    Zona: {zone.name}
                  </h2>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}
                  </span>
                </header>

                <ul className="divide-y divide-border">
                  {tasks.map((task, index) => {
                    const isOver = overIndex === index;
                    return (
                      <li
                        key={task.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", task.id);
                          setDrag({ zone: zone.id, overIndex: index });
                        }}
                        onDragOver={(e) => {
                          if (!drag || drag.zone !== zone.id) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (drag.overIndex !== index) {
                            setDrag({ ...drag, overIndex: index });
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (drag && drag.zone === zone.id) {
                            commitReorder(
                              zone.id,
                              drag.overIndex,
                              index
                            );
                          }
                          setDrag(null);
                        }}
                        onDragEnd={() => setDrag(null)}
                        className={
                          "flex items-center gap-2.5 px-4 py-2.5 transition-colors " +
                          (isOver ? "bg-[#0066CC]/5" : "hover:bg-muted/30")
                        }
                      >
                        <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing" />
                        <span className="w-5 shrink-0 font-mono text-[11px] text-muted-foreground">
                          {index + 1}.
                        </span>
                        <span
                          className={
                            "min-w-0 flex-1 truncate text-xs " +
                            (task.isActive === false
                              ? "text-muted-foreground line-through"
                              : "text-foreground")
                          }
                        >
                          {task.description}
                        </span>

                        {task.isCritical && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-300 px-1.5 py-0.5 text-[9px] font-bold text-red-600 dark:border-red-900 dark:text-red-400">
                            <ShieldAlert className="size-2.5" />
                            Crítica
                          </span>
                        )}
                        {task.requiresPhoto && (
                          <span
                            title="Requiere foto"
                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground"
                          >
                            <Camera className="size-2.5" />
                            Foto
                          </span>
                        )}

                        <span className="flex shrink-0 items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Editar tarea"
                            onClick={() => openEdit(task)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Eliminar tarea"
                            onClick={() => setDeletingTask(task)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t border-border px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCreate(zone.id)}
                    className="h-7 w-full justify-start gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                    Agregar tarea en {zone.name}
                  </Button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TaskFormDialog
        key={editingTask?.id ?? `new-${formZone}`}
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        moduleId={module.id}
        defaultZone={formZone}
        task={editingTask}
        zoneTaskCounts={zoneTaskCounts}
        zones={zones}
        onSaved={() => router.refresh()}
      />

      <TaskBatchDialog
        key={`batch-${formZone}`}
        open={isBatchOpen}
        onOpenChange={setIsBatchOpen}
        moduleId={module.id}
        defaultZone={formZone}
        zones={zones}
        zoneTaskCounts={zoneTaskCounts}
        onSaved={() => router.refresh()}
      />

      <Dialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
      >
        <DialogContent className="bg-card border-border sm:max-w-[420px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive">
              Eliminar tarea
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Se eliminará{" "}
              <strong className="text-foreground">
                {deletingTask?.description}
              </strong>{" "}
              del módulo {module.code}. Si la tarea ya se ejecutó en campo, su
              registro histórico se pierde.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingTask(null)}
              className="text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleDelete}
              className="text-xs bg-destructive hover:bg-destructive/90 text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
