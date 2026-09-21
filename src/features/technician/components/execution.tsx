"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  type TechnicianWorkOrderExecution,
  type TechnicianElevator,
} from "../queries";
import {
  startWorkOrder,
  saveElevatorFindings,
  addElevatorEvidence,
  removeElevatorEvidence,
  completeWorkOrder,
  type ElevatorFinalStatus,
} from "../actions";
import { fileToCompressedDataUrl } from "../lib/media";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import {
  Building2,
  CalendarDays,
  Camera,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Eraser,
  Loader2,
  MapPin,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

function formatDate(date: string | null, time?: string | null): string {
  if (!date) return "Sin programar";
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return time ? `${base} · ${time}` : base;
}

export function TechnicianExecutionView({
  workOrder,
}: {
  workOrder: TechnicianWorkOrderExecution;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [findings, setFindings] = useState<Record<string, string>>(() =>
    Object.fromEntries(workOrder.elevators.map((e) => [e.id, e.finding ?? ""]))
  );
  const [findingStatus, setFindingStatus] = useState<
    Record<string, "idle" | "saving" | "saved">
  >({});
  const [uploadingElevator, setUploadingElevator] = useState<string | null>(null);
  const [activeElevatorId, setActiveElevatorId] = useState<string | null>(
    workOrder.elevators[0]?.id ?? null
  );
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [elevatorStatuses, setElevatorStatuses] = useState<
    Record<string, ElevatorFinalStatus>
  >(() =>
    Object.fromEntries(
      workOrder.elevators.map((e) => [e.id, "OPERATIVE"])
    )
  );
  const signatureRef = useRef<SignaturePadHandle>(null);
  const [removeTarget, setRemoveTarget] = useState<{
    elevatorId: string;
    url: string;
  } | null>(null);

  const isCompleted = workOrder.status === "COMPLETED";

  const serverFindings = useMemo(
    () =>
      Object.fromEntries(
        workOrder.elevators.map((e) => [e.id, e.finding ?? ""])
      ),
    [workOrder.elevators]
  );

  // Autoguardado de hallazgos: guarda ~1s después de la última tecla.
  useEffect(() => {
    const dirty = Object.keys(findings).filter(
      (id) => findings[id] !== (serverFindings[id] ?? "")
    );
    if (dirty.length === 0) return;

    const timer = setTimeout(() => {
      void (async () => {
        for (const id of dirty) {
          setFindingStatus((prev) => ({ ...prev, [id]: "saving" }));
          const res = await saveElevatorFindings(id, findings[id] ?? "");
          setFindingStatus((prev) => ({
            ...prev,
            [id]: res.success ? "saved" : "idle",
          }));
          if (!res.success) {
            toast.error("Error al guardar hallazgos", {
              description: res.error,
            });
          }
        }
      })();
    }, 1000);
    return () => clearTimeout(timer);
  }, [findings, serverFindings]);

  // Vuelca los hallazgos pendientes antes de completar la orden.
  async function flushFindings(): Promise<void> {
    for (const elevator of workOrder.elevators) {
      const value = findings[elevator.id] ?? "";
      if (value !== (elevator.finding ?? "")) {
        await saveElevatorFindings(elevator.id, value);
      }
    }
  }

  function handleStart() {
    startTransition(async () => {
      const res = await startWorkOrder(workOrder.id);
      if (res.success) {
        toast.success("Orden iniciada", { description: res.message });
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  async function handleFiles(
    elevatorId: string,
    files: FileList | null
  ) {
    if (!files || files.length === 0) return;
    setUploadingElevator(elevatorId);
    try {
      const images = await Promise.all(
        Array.from(files)
          .slice(0, 4)
          .map((file) => fileToCompressedDataUrl(file))
      );
      const res = await addElevatorEvidence(elevatorId, images);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    } catch (error) {
      toast.error("Error", {
        description:
          error instanceof Error ? error.message : "No se pudo subir la foto.",
      });
    } finally {
      setUploadingElevator(null);
    }
  }

  function handleRemoveEvidence() {
    if (!removeTarget) return;
    startTransition(async () => {
      const res = await removeElevatorEvidence(
        removeTarget.elevatorId,
        removeTarget.url
      );
      if (res.success) {
        toast.success(res.message);
        setRemoveTarget(null);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleComplete() {
    const signatureDataUrl = signatureRef.current?.getDataUrl();
    if (!signatureDataUrl) {
      toast.error("Firma requerida", {
        description: "El cliente debe firmar en el recuadro.",
      });
      return;
    }
    startTransition(async () => {
      await flushFindings();
      const res = await completeWorkOrder({
        workOrderId: workOrder.id,
        clientName,
        signatureDataUrl,
        elevatorStatuses,
      });
      if (res.success) {
        toast.success(res.message);
        setSignatureOpen(false);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  if (isCompleted) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/5 py-10 px-6 text-center space-y-3">
          <CheckCircle2 className="size-12 text-emerald-500" />
          <div>
            <p className="text-lg font-bold">Orden completada</p>
            <p className="text-xs text-muted-foreground mt-1">
              {workOrder.otNumber} se cerró correctamente.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-semibold text-muted-foreground">
              Firma del cliente
            </p>
            {workOrder.clientSignatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={workOrder.clientSignatureUrl}
                alt="Firma del cliente"
                className="h-16 bg-white border border-border rounded-lg object-contain"
              />
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
            {workOrder.clientSignerName && (
              <p className="text-sm font-semibold">{workOrder.clientSignerName}</p>
            )}
          </div>
          <Button
            render={<Link href="/technician/work-orders" />}
            variant="outline"
            nativeButton={false}
            className="w-full min-h-[48px]"
          >
            Volver a mis órdenes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
            <ClipboardList className="size-4 text-[#0066CC]" />
            {workOrder.otNumber}
          </span>
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
              workOrder.status === "IN_PROGRESS"
                ? "bg-blue-500/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
            )}
          >
            {STATUS_LABELS[workOrder.status || "PENDING"] ?? workOrder.status}
          </span>
        </div>
        <p className="flex items-center gap-2 text-sm font-semibold leading-snug">
          <Building2 className="size-4 text-[#0066CC] shrink-0" />
          {workOrder.client_name}
        </p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {workOrder.cost_center_name}
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-semibold">
            <CalendarDays className="size-3.5 text-[#0066CC] shrink-0" />
            {formatDate(workOrder.scheduledDate, workOrder.scheduledTime)}
          </span>
          {workOrder.startedAt && (
            <span className="text-muted-foreground">
              Inicio:{" "}
              {new Date(workOrder.startedAt).toLocaleTimeString("es-PE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {workOrder.status !== "IN_PROGRESS" && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted/30 py-8 px-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Cuando llegues al lugar, presiona para iniciar la orden y registrar
            el horario de trabajo.
          </p>
          <Button
            className="w-full min-h-[52px] text-base font-bold"
            onClick={handleStart}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
            Iniciar trabajo
          </Button>
        </div>
      )}

      {workOrder.status === "IN_PROGRESS" && (
        <>
          <div className="space-y-3">
            {workOrder.elevators.map((elevator) => (
              <ElevatorSection
                key={elevator.id}
                elevator={elevator}
                active={activeElevatorId === elevator.id}
                onToggle={() =>
                  setActiveElevatorId((prev) =>
                    prev === elevator.id ? null : elevator.id
                  )
                }
                finding={findings[elevator.id] ?? ""}
                onFindingChange={(value) =>
                  setFindings((prev) => ({ ...prev, [elevator.id]: value }))
                }
                saveStatus={findingStatus[elevator.id] ?? "idle"}
                uploading={uploadingElevator === elevator.id}
                onUpload={(files) => handleFiles(elevator.id, files)}
                onRequestRemove={(url) =>
                  setRemoveTarget({ elevatorId: elevator.id, url })
                }
              />
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/90 backdrop-blur p-3">
            <div className="mx-auto w-full max-w-md">
              <Button
                className="w-full min-h-[52px] text-base font-bold"
                onClick={() => setSignatureOpen(true)}
              >
                <Eraser className="size-5" />
                Finalizar orden de trabajo
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="bg-card border-border sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <X className="size-4 text-red-500" />
              Eliminar evidencia
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              ¿Eliminar esta foto? El técnico podrá volver a agregarla si es
              necesario.
            </DialogDescription>
          </DialogHeader>

          {removeTarget && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={removeTarget.url}
              alt="Evidencia a eliminar"
              className="aspect-square w-full object-cover rounded-lg border border-border"
            />
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 min-h-[48px]"
              onClick={() => setRemoveTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1 min-h-[48px] font-bold bg-red-600 hover:bg-red-700"
              onClick={handleRemoveEvidence}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="bg-card border-border sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <StickyNote className="size-4 text-[#0066CC]" />
              Cierre de la orden
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Indica el estado final de cada equipo y solicita la firma del
              responsable del cliente para dar por finalizados los trabajos en{" "}
              {workOrder.otNumber}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Estado final de los equipos
              </div>
              {workOrder.elevators.map((elevator) => (
                <div
                  key={elevator.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold truncate">
                      {elevator.internalCode}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {elevator.elevatorName}
                    </p>
                  </div>
                  <div className="flex shrink-0 rounded-lg border border-border overflow-hidden">
                    {(["OPERATIVE", "OUT_OF_SERVICE"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setElevatorStatuses((prev) => ({
                            ...prev,
                            [elevator.id]: status,
                          }))
                        }
                        className={cn(
                          "px-3 py-1.5 text-[11px] font-bold transition-colors",
                          elevatorStatuses[elevator.id] === status
                            ? status === "OPERATIVE"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {status === "OPERATIVE"
                          ? "Operativo"
                          : "Fuera de servicio"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label
                htmlFor="client-signer"
                className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Nombre de quien firma
              </label>
              <input
                id="client-signer"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nombre y cargo del cliente"
                className="mt-1 flex h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:light]"
              />
            </div>

            <SignaturePad ref={signatureRef} />

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1 min-h-[48px]"
                onClick={() => setSignatureOpen(false)}
              >
                <X className="size-4" />
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1 min-h-[48px] font-bold"
                onClick={handleComplete}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCheck className="size-4" />
                )}
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ElevatorSection({
  elevator,
  active,
  onToggle,
  finding,
  onFindingChange,
  saveStatus,
  uploading,
  onUpload,
  onRequestRemove,
}: {
  elevator: TechnicianElevator;
  active: boolean;
  onToggle: () => void;
  finding: string;
  onFindingChange: (value: string) => void;
  saveStatus: "idle" | "saving" | "saved";
  uploading: boolean;
  onUpload: (files: FileList | null) => void;
  onRequestRemove: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const completedTasks = useMemo(
    () => elevator.tasks.filter((t) => t.isCompleted).length,
    [elevator.tasks]
  );

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted border border-border">
          {elevator.internalCode}
        </span>
        <span className="flex-1 text-sm font-semibold truncate">
          {elevator.elevatorName}
        </span>
        <span
          className={cn(
            "inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border",
            elevator.status === "COMPLETED"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          )}
        >
          {elevator.status === "COMPLETED" ? "Completado" : "Pendiente"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            active && "rotate-180"
          )}
        />
      </button>

      {active && (
        <div className="border-t border-border px-4 py-3 space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <StickyNote className="size-3.5" />
                Hallazgos
              </div>
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Guardando...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                  <CheckCircle2 className="size-3" />
                  Guardado
                </span>
              )}
            </div>
            <textarea
              value={finding}
              onChange={(e) => onFindingChange(e.target.value)}
              rows={3}
              placeholder="Describe lo encontrado durante la intervención..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 resize-y"
            />
            <p className="text-[10px] text-muted-foreground">
              Se guarda automáticamente mientras escribes.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Camera className="size-3.5" />
              Evidencias ({elevator.evidencePhotoUrls?.length ?? 0})
            </div>
            {elevator.evidencePhotoUrls && elevator.evidencePhotoUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {elevator.evidencePhotoUrls.map((url, idx) => (
                  <div
                    key={url}
                    className="relative aspect-square w-full overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Evidencia ${idx + 1}`}
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRequestRemove(url)}
                      title="Eliminar foto"
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-red-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                onUpload(e.target.files);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-[44px]"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Camera className="size-4" />
              )}
              {uploading ? "Subiendo..." : "Agregar fotos"}
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <CheckCircle2 className="size-3.5" />
              Checklist ({completedTasks}/{elevator.tasks.length})
            </div>
            {elevator.tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Sin tareas registradas para este equipo.
              </p>
            ) : (
              <ul className="space-y-1">
                {elevator.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5"
                  >
                    {task.isCompleted ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-xs flex-1",
                        task.isCompleted &&
                          "line-through text-muted-foreground/60"
                      )}
                    >
                      {task.taskDescription}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}