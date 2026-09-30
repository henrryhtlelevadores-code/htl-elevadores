"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Loader2,
  StickyNote,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type TechnicianElevator,
  type TechnicianTask,
} from "../queries";
import {
  type ElevatorFinishMode,
} from "../actions";
import { runSync } from "../lib/sync-client";
import { PhotoGallery } from "./photo-gallery";
import { PhotoModal } from "./photo-modal";
import { FindingsTextArea } from "./findings-textarea";

type TaskGroup = { key: string; label: string; tasks: TechnicianTask[] };

const GENERAL_KEY = "__general__";

const MIN_PHOTOS = 4;

export function MaintenanceChecklist({
  elevator,
  onBack,
}: {
  elevator: TechnicianElevator;
  onBack: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [openModules, setOpenModules] = useState<Record<string, boolean>>(
    () => {
      const map: Record<string, boolean> = {};
      for (const task of elevator.tasks) {
        map[task.moduleId ?? GENERAL_KEY] = true;
      }
      return map;
    }
  );
  const [obsByTask, setObsByTask] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      elevator.tasks.map((task) => [task.id, task.observations ?? ""])
    )
  );
  const [obsStatus, setObsStatus] = useState<
    Record<string, "idle" | "saving" | "saved">
  >({});
  const [photoTarget, setPhotoTarget] = useState<{ taskId: string | null } | null>(
    null
  );
  const [finishDialog, setFinishDialog] = useState<
    "confirm_all" | "choose_mode" | null
  >(null);
  const [tasks, setTasks] = useState<TechnicianTask[]>(() => elevator.tasks);

  const photoCount = elevator.photos.length;
  const photosRequired = elevator.photosRequired;
  const photosOk = !photosRequired || photoCount >= MIN_PHOTOS;

  const groups = useMemo(() => {
    const map = new Map<string, TaskGroup>();
    for (const task of tasks) {
      const key = task.moduleId ?? GENERAL_KEY;
      const label = task.moduleId
        ? [task.moduleCode, task.moduleName].filter(Boolean).join(" · ") || "Módulo"
        : "General";
      const group = map.get(key) ?? { key, label, tasks: [] as TechnicianTask[] };
      group.tasks.push(task);
      map.set(key, group);
    }
    return Array.from(map.values());
  }, [tasks]);

  const serverObs = useMemo(
    () =>
      Object.fromEntries(
        elevator.tasks.map((task) => [task.id, task.observations ?? ""])
      ),
    [elevator.tasks]
  );

  const [findings, setFindings] = useState(() => elevator.finding ?? "");
  const [findingsStatus, setFindingsStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const serverFindings = elevator.finding ?? "";

  const completed = tasks.filter((t) => t.isCompleted).length;
  const total = tasks.length;
  const elevatorDone = elevator.status === "COMPLETED";
  const percent = total === 0 ? 100 : Math.round((completed / total) * 100);

  // Autoguardado de observaciones de cada tarea.
  useEffect(() => {
    const dirty = Object.keys(obsByTask).filter(
      (id) => (obsByTask[id] ?? "") !== (serverObs[id] ?? "")
    );
    if (dirty.length === 0) return;

    const timer = setTimeout(() => {
      for (const id of dirty) {
        setObsStatus((prev) => ({ ...prev, [id]: "saving" }));
        void runSync("updateWorkOrderTask", {
          taskId: id,
          data: { observations: obsByTask[id] ?? "" },
        }).then((res) => {
          setObsStatus((prev) => ({
            ...prev,
            [id]: res.success ? "saved" : "idle",
          }));
          if (!res.success) {
            toast.error("Error al guardar", { description: res.error });
          }
        });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [obsByTask, serverObs]);

  // Autoguardado de hallazgos con debounce (2s después de dejar de escribir).
  useEffect(() => {
    if (findings === serverFindings) return;
    const timer = setTimeout(() => {
      setFindingsStatus("saving");
      void runSync("updateElevatorFindings", {
        elevatorId: elevator.id,
        findings,
      }).then((res) => {
        setFindingsStatus(res.success ? "saved" : "error");
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [findings, serverFindings, elevator.id]);

  function handleFindingsBlur() {
    if (findings === serverFindings) return;
    setFindingsStatus("saving");
    void runSync("updateElevatorFindings", {
      elevatorId: elevator.id,
      findings,
    }).then((res) => {
      setFindingsStatus(res.success ? "saved" : "error");
    });
  }

  function setTasksInPlace(
    ids: ReadonlySet<string>,
    patch: (task: TechnicianTask) => TechnicianTask
  ) {
    setTasks((prev) => prev.map((task) => (ids.has(task.id) ? patch(task) : task)));
  }

  function handleToggle(task: TechnicianTask) {
    const next = !task.isCompleted;
    setTasksInPlace(
      new Set([task.id]),
      (t) =>
        ({
          ...t,
          isCompleted: next,
          status: next ? "COMPLETED" : "PENDING",
          completedAt: next ? Date.now() : null,
        }) as TechnicianTask
    );
    startTransition(async () => {
      const res = await runSync("updateWorkOrderTask", {
        taskId: task.id,
        data: { isCompleted: next },
      });
      if (res.success) {
        router.refresh();
      } else {
        setTasksInPlace(
          new Set([task.id]),
          (t) =>
            ({
              ...t,
              isCompleted: !next,
              status: !next ? "COMPLETED" : "PENDING",
              completedAt: !next ? (t.completedAt ?? null) : null,
            }) as TechnicianTask
        );
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleBulkToggle(group: TaskGroup) {
    const moduleIds = new Set(group.tasks.map((t) => t.id));
    const done = group.tasks.filter((t) => t.isCompleted).length;
    const shouldMarkAll = done !== group.tasks.length;
    const moduleId = group.tasks[0]?.moduleId ?? null;
    const moduleLabel = group.label.split(" · ")[0] ?? "Módulo";

    setTasksInPlace(
      moduleIds,
      (t) =>
        ({
          ...t,
          isCompleted: shouldMarkAll,
          status: shouldMarkAll ? "COMPLETED" : "PENDING",
          completedAt: shouldMarkAll ? Date.now() : null,
        }) as TechnicianTask
    );
    startTransition(async () => {
      const res = await runSync("bulkUpdateModuleTasks", {
        elevatorId: elevator.id,
        moduleId,
        isCompleted: shouldMarkAll,
      });
      if (res.success) {
        toast.success(
          shouldMarkAll
            ? `${moduleLabel} marcado como completado`
            : `${moduleLabel} desmarcado`
        );
        router.refresh();
      } else {
        setTasksInPlace(
          moduleIds,
          (t) =>
            ({
              ...t,
              isCompleted: !shouldMarkAll,
              status: !shouldMarkAll ? "COMPLETED" : "PENDING",
              completedAt: !shouldMarkAll ? Date.now() : null,
            }) as TechnicianTask
        );
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleFinish() {
    if (photosRequired && photoCount < MIN_PHOTOS) {
      toast.error("Fotos insuficientes", {
        description: `Debes subir al menos ${MIN_PHOTOS} fotos. Faltan ${
          MIN_PHOTOS - photoCount
        }.`,
      });
      return;
    }
    const completedCount = tasks.filter((t) => t.isCompleted).length;
    const totalCount = tasks.length;
    if (completedCount === 0) {
      setFinishDialog("confirm_all");
    } else if (completedCount < totalCount) {
      setFinishDialog("choose_mode");
    } else {
      finalize("all_completed");
    }
  }

  function finalize(mode: ElevatorFinishMode) {
    setFinishDialog(null);
    startTransition(async () => {
      const res = await runSync("completeElevator", {
        elevatorId: elevator.id,
        mode,
      });
      if (res.success) {
        toast.success("Equipo finalizado", { description: res.message });
        onBack();
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleRemovePhoto(photoId: string) {
    startTransition(async () => {
      const res = await runSync("removeElevatorPhoto", { photoId });
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-[44px] -ml-2"
        onClick={onBack}
      >
        <ArrowLeft className="size-4" />
        Volver a equipos
      </Button>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-1 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#0066CC]/10 text-[#0066CC] border border-[#0066CC]/20">
            {elevator.internalCode}
          </span>
          <h2 className="text-sm font-bold leading-tight truncate flex-1">
            {elevator.elevatorName}
          </h2>
          <span
            className={cn(
              "inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase border",
              elevatorDone
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            )}
          >
            {elevatorDone ? "Completado" : "En mantenimiento"}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {elevator.elevatorType} · {elevator.brand}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">
            Progreso: {completed}/{total} tareas
          </p>
          <span className="text-xs font-bold text-muted-foreground">
            {percent}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {groups.length === 0 && (
        <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Este equipo no tiene tareas de mantenimiento registradas.
        </div>
      )}

      {groups.map((group) => {
        const open = openModules[group.key] ?? false;
        const groupDone = group.tasks.every((t) => t.isCompleted);
        const doneCount = group.tasks.filter((t) => t.isCompleted).length;
        const moduleState =
          doneCount === 0
            ? "none"
            : doneCount === group.tasks.length
              ? "all"
              : "some";
        return (
          <div
            key={group.key}
            className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
          >
            <div className="flex items-center">
              <div className="flex items-center pl-4 pr-1.5">
                <Checkbox
                  checked={moduleState === "all"}
                  indeterminate={moduleState === "some"}
                  onCheckedChange={() => handleBulkToggle(group)}
                  aria-label={`Aceptar todas las tareas de ${group.label}`}
                  disabled={isPending}
                />
              </div>
            <button
              type="button"
              onClick={() =>
                setOpenModules((prev) => ({
                  ...prev,
                  [group.key]: !(prev[group.key] ?? false),
                }))
              }
              className="flex w-full items-center gap-2 px-2.5 py-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {group.label}{" "}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    ({group.tasks.length} tarea{group.tasks.length === 1 ? "" : "s"})
                  </span>
                </p>
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    groupDone ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  )}
                >
                  {group.tasks.filter((t) => t.isCompleted).length}/{group.tasks.length}{" "}
                  {groupDone ? "· completado" : ""}
                </p>
              </div>
              {groupDone ? (
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="size-4 text-muted-foreground shrink-0" />
              )}
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  open && "rotate-180"
                )}
              />
            </button>
            </div>

            {open && (
              <div className="border-t border-border space-y-2 px-3 py-3">
                {group.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    observation={obsByTask[task.id] ?? ""}
                    observationStatus={obsStatus[task.id] ?? "idle"}
                    pending={isPending}
                    onObservationChange={(value) =>
                      setObsByTask((prev) => ({ ...prev, [task.id]: value }))
                    }
                    onToggle={() => handleToggle(task)}
                    onAddPhoto={() => setPhotoTarget({ taskId: task.id })}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <FindingsTextArea
        value={findings}
        onChange={setFindings}
        onBlur={handleFindingsBlur}
      />
      <div className="flex items-center gap-1.5 -mt-2 text-[11px] font-semibold text-muted-foreground">
        {findingsStatus === "saving" && (
          <>
            <Loader2 className="size-3 animate-spin" />
            Guardando...
          </>
        )}
        {findingsStatus === "saved" && findings && (
          <>
            <CheckCircle2 className="size-3 text-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">
              Guardado
            </span>
          </>
        )}
        {findingsStatus === "error" && (
          <>
            <AlertTriangle className="size-3 text-red-500" />
            <span className="text-red-600 dark:text-red-400">
              Error al guardar
            </span>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="size-3.5" />
            Evidencia fotográfica del equipo
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[40px]"
            onClick={() => setPhotoTarget({ taskId: null })}
            disabled={isPending}
          >
            <Camera className="size-4" />
            Agregar foto
          </Button>
        </div>
        {photosRequired && (
          <div
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-semibold",
              photosOk
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            )}
          >
            {photosOk ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <AlertTriangle className="size-3.5" />
            )}
            Fotos del equipo ({photoCount}/{MIN_PHOTOS} mínimo)
          </div>
        )}
        <PhotoGallery photos={elevator.photos} onRemove={handleRemovePhoto} />
      </div>

      {elevatorDone ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-5" />
          Equipo completado
        </div>
      ) : (
        <Button
          type="button"
          className="w-full min-h-[52px] text-base font-bold"
          onClick={handleFinish}
          disabled={!photosOk || isPending}
        >
          {isPending ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-5" />
          )}
          Finalizar equipo
        </Button>
      )}
      {!elevatorDone && photosRequired && !photosOk && (
        <p className="flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-amber-600 dark:text-amber-400 -mt-2">
          <AlertTriangle className="size-3.5" />
          Faltan {MIN_PHOTOS - photoCount} fotos para poder finalizar
        </p>
      )}

      {photoTarget && (
        <PhotoModal
          onClose={() => setPhotoTarget(null)}
          elevatorId={elevator.id}
          taskId={photoTarget.taskId}
        />
      )}

      <Dialog
        open={finishDialog === "confirm_all"}
        onOpenChange={(open) => !open && setFinishDialog(null)}
      >
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              ¿Finalizar todo?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              No has marcado ninguna tarea del checklist. ¿Confirmas que las{" "}
              {total} tareas de este equipo están completas?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFinishDialog(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => finalize("all_completed")}
              disabled={isPending}
            >
              Sí, finalizar todo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={finishDialog === "choose_mode"}
        onOpenChange={(open) => !open && setFinishDialog(null)}
      >
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Faltan tareas
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Has completado {completed} de {total} tareas. ¿Cómo deseas
              finalizar?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-semibold"
              onClick={() => setFinishDialog(null)}
            >
              Seguir trabajando
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start font-semibold"
              onClick={() => finalize("all_completed")}
              disabled={isPending}
            >
              Marcar todas como completadas
            </Button>
            <Button
              type="button"
              className="w-full justify-start font-bold"
              onClick={() => finalize("partial")}
              disabled={isPending}
            >
              Finalizar solo las marcadas
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskItem({
  task,
  observation,
  observationStatus,
  pending,
  onObservationChange,
  onToggle,
  onAddPhoto,
}: {
  task: TechnicianTask;
  observation: string;
  observationStatus: "idle" | "saving" | "saved";
  pending: boolean;
  onObservationChange: (value: string) => void;
  onToggle: () => void;
  onAddPhoto: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          disabled={pending}
          title={task.isCompleted ? "Desmarcar tarea" : "Marcar como completada"}
          className="shrink-0"
        >
          {task.isCompleted ? (
            <CheckCircle2 className="size-5 text-emerald-500" />
          ) : (
            <Circle className="size-5 text-muted-foreground" />
          )}
        </button>
        <p
          className={cn(
            "flex-1 text-xs leading-snug",
            task.isCompleted && "line-through text-muted-foreground/60"
          )}
        >
          {task.taskDescription}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[36px] px-2"
            onClick={onAddPhoto}
          >
            <Camera className="size-4" />
          </Button>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="p-1"
            title="Observaciones y opciones"
          >
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border px-3 py-2.5 space-y-2">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Observaciones (opcional)
            </label>
            <textarea
              value={observation}
              onChange={(e) => onObservationChange(e.target.value)}
              rows={2}
              placeholder="Detalle de la tarea realizada..."
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
            {observationStatus === "saving" && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Guardando...
              </p>
            )}
            {observationStatus === "saved" && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-500">
                <CheckCircle2 className="size-3" />
                Guardado
              </p>
            )}
          </div>
          <div className="flex items-start gap-1 text-[11px] text-muted-foreground">
            <StickyNote className="size-3.5 shrink-0 mt-0.5" />
            Las fotos se registran como Antes, Después o Puntual.
          </div>
        </div>
      )}
    </div>
  );
}