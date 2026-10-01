"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { type TechnicianWorkOrderExecution } from "../queries";
import { type ElevatorFinalStatus } from "../actions";
import { runSync } from "../lib/sync-client";
import { SyncStatus } from "./sync-status";
import { SignaturePad, type SignaturePadHandle } from "./signature-pad";
import { TechnicianOrderPreview } from "./preview";
import { ElevatorSelector } from "./elevator-selector";
import { SafetyForm } from "./safety-form";
import { MaintenanceChecklist } from "./maintenance-checklist";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Copy,
  Loader2,
  MapPin,
  Phone,
  StickyNote,
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
  slaRemainingLabel,
}: {
  workOrder: TechnicianWorkOrderExecution;
  slaRemainingLabel?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedElevatorId, setSelectedElevatorId] = useState<string | null>(
    workOrder.elevators.length === 1 ? workOrder.elevators[0].id : null
  );
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [elevatorStatuses, setElevatorStatuses] = useState<
    Record<string, ElevatorFinalStatus>
  >({});
  const [reportElevator, setReportElevator] = useState<{
    id: string;
    internalCode: string;
  } | null>(null);
  const signatureRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    if (!signatureOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [signatureOpen]);

  const isCompleted = workOrder.status === "COMPLETED";
  const selectedElevator =
    workOrder.elevators.find((e) => e.id === selectedElevatorId) ?? null;
  const showTasks =
    !!selectedElevator &&
    selectedElevator.safety?.status === "COMPLETED";
  const allComplete = workOrder.elevators.every(
    (e) => e.status === "COMPLETED"
  );
  const missingStatusCount = workOrder.elevators.filter(
    (elevator) => !elevatorStatuses[elevator.id]
  ).length;
  const isFormValid =
    missingStatusCount === 0 && clientName.trim().length > 0 &&
    Boolean(signatureDataUrl);

  function handleStart() {
    startTransition(async () => {
      const res = await runSync("startWorkOrder", {
        workOrderId: workOrder.id,
      });
      if (res.success) {
        toast.success("Orden iniciada", { description: res.message });
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleFinalize() {
    setSignatureDataUrl(null);
    signatureRef.current?.clear();
    setSignatureOpen(true);
  }

  function handleElevatorStatus(
    status: ElevatorFinalStatus,
    elevator: { id: string; internalCode: string }
  ) {
    setElevatorStatuses((prev) => ({ ...prev, [elevator.id]: status }));
    if (status === "UNCOMPLETED_MAINTENANCE") {
      setReportElevator(elevator);
    }
  }

  const reportMessage = reportElevator
    ? `Hola Henrry, tengo un problema en el equipo ${reportElevator.internalCode} del cliente ${workOrder.client_name}. Se marcó como mantenimiento sin culminar. Necesito coordinar una visita de emergencia.`
    : "";

  async function handleCopyMessage() {
    if (!reportElevator) return;
    try {
      await navigator.clipboard.writeText(reportMessage);
      toast.success("Mensaje copiado", {
        description: "Pégalo en WhatsApp o llámalo directamente.",
      });
    } catch {
      toast.error("No se pudo copiar", {
        description: "Selecciona y copia el mensaje manualmente.",
      });
    }
  }

  function handleComplete() {
    const signature = signatureRef.current?.getDataUrl();
    if (!signature) {
      toast.error("Firma requerida", {
        description: "El cliente debe firmar en el recuadro.",
      });
      return;
    }
    startTransition(async () => {
      const res = await runSync("completeWorkOrder", {
        workOrderId: workOrder.id,
        clientName,
         signatureDataUrl: signature,
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

  // Vista previa antes de iniciar: aún no hay ejecución que mostrar.
  if (workOrder.status !== "IN_PROGRESS") {
    return (
      <TechnicianOrderPreview
        workOrder={workOrder}
        isPending={isPending}
        onStart={handleStart}
        slaRemainingLabel={slaRemainingLabel}
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="flex justify-end">
        <SyncStatus />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-2 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
            <ClipboardList className="size-4 text-[#0066CC]" />
            {workOrder.otNumber}
          </span>
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
              "bg-blue-500/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20"
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

      {selectedElevator ? (
        showTasks ? (
          <MaintenanceChecklist
            elevator={selectedElevator}
            onBack={() => setSelectedElevatorId(null)}
          />
        ) : (
          <SafetyForm
            elevator={selectedElevator}
            onBack={() => setSelectedElevatorId(null)}
          />
        )
      ) : (
        <ElevatorSelector
          elevators={workOrder.elevators}
          onSelect={(elevator) => setSelectedElevatorId(elevator.id)}
          allComplete={allComplete}
          onFinalize={handleFinalize}
          isFinishing={isPending}
        />
      )}

      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="fixed inset-x-0 bottom-0 top-auto grid max-h-[92dvh] w-full max-w-[560px] translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-t-2xl border-border bg-card p-0 sm:inset-y-1/2 sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-h-[88dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pr-12 sm:px-6">
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

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            <div className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-3">
              <p className="font-mono text-sm font-bold">{workOrder.otNumber}</p>
              <p className="mt-1 text-sm font-semibold">{workOrder.cost_center_name}</p>
              <p className="mt-1 text-xs text-muted-foreground">Indica el estado final de cada equipo y solicita la firma del responsable del cliente.</p>
            </div>
            <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Estado final de los equipos
              </div>
              {workOrder.elevators.map((elevator) => (
                <div
                  key={elevator.id}
                  className="space-y-3 rounded-xl border border-border bg-background p-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold truncate">
                      {elevator.internalCode}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {elevator.elevatorName}
                    </p>
                  </div>
                   <div className="grid grid-cols-1 gap-1.5 min-[400px]:grid-cols-3">
                    {(["OPERATIVE", "OUT_OF_SERVICE", "UNCOMPLETED_MAINTENANCE"] as const).map(
                      (status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() =>
                            handleElevatorStatus(status, {
                              id: elevator.id,
                              internalCode: elevator.internalCode ?? "—",
                            })
                          }
                          className={cn(
                            "min-h-11 rounded-lg border px-2 py-2 text-[11px] font-bold transition-colors",
                            elevatorStatuses[elevator.id] === status
                              ? status === "OPERATIVE"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : status === "OUT_OF_SERVICE"
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                          aria-pressed={elevatorStatuses[elevator.id] === status}
                        >
                          {status === "OPERATIVE"
                            ? "Operativo"
                            : status === "OUT_OF_SERVICE"
                              ? "Fuera de servicio"
                              : "Mant. sin culminar"}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>

            {!isFormValid && (
              <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                {missingStatusCount > 0 && <p>⚠ Faltan {missingStatusCount} equipos por marcar estado final.</p>}
                {!clientName.trim() && <p>⚠ Falta el nombre del firmante.</p>}
                {!signatureDataUrl && <p>⚠ Falta la firma del cliente.</p>}
              </div>
            )}

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

             <SignaturePad ref={signatureRef} onChange={setSignatureDataUrl} className="touch-none" />
           </div>
          </div>
          <div className="flex shrink-0 justify-between gap-2 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => setSignatureOpen(false)}>Cancelar</Button>
            <Button type="button" className="min-h-11 font-bold" onClick={handleComplete} disabled={isPending || !isFormValid}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
              ✓ Finalizar OT
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!reportElevator}
        onOpenChange={(open) => {
          if (!open) setReportElevator(null);
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5" />
              Reportar problema al administrador
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              El equipo{" "}
              <span className="font-mono font-semibold text-foreground">
                {reportElevator?.internalCode}
              </span>{" "}
              se marcó como &ldquo;Mantenimiento sin Culminar&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed">
              Por favor, contacta a Henrry para reportar la situación y
              coordinar una visita de emergencia.
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Phone className="size-4 text-[#0066CC]" />
                +51 963 207 058
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full min-h-[48px] font-semibold"
                onClick={handleCopyMessage}
              >
                <Copy className="size-4" />
                Copiar mensaje
              </Button>
              <Button
                render={<a href="tel:+51963207058" />}
                nativeButton={false}
                variant="default"
                className="w-full min-h-[48px] font-bold"
              >
                <Phone className="size-4" />
                Llamar a Henrry
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full min-h-[44px]"
                onClick={() => setReportElevator(null)}
              >
                <X className="size-4" />
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
