"use client";

import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Loader2,
  Play,
  ShieldCheck,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { type TechnicianElevator } from "../queries";

const SAFETY_LABEL: Record<string, string> = {
  COMPLETED: "Completada",
  PENDING: "Pendiente",
};

const ELEVATOR_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
};

function StatusIndicator({
  label,
  done,
  value,
}: {
  label: string;
  done: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      {done ? (
        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
      ) : (
        <Circle className="size-4 text-amber-500 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-xs font-bold truncate">{value}</p>
      </div>
    </div>
  );
}

export function ElevatorSelector({
  elevators,
  onSelect,
  allComplete,
  onFinalize,
  isFinishing,
}: {
  elevators: TechnicianElevator[];
  onSelect: (elevator: TechnicianElevator) => void;
  allComplete: boolean;
  onFinalize: () => void;
  isFinishing: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Selecciona el equipo a intervenir</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Completa la seguridad y el checklist de cada equipo antes de finalizar
          la orden.
        </p>
      </div>

      {elevators.map((elevator) => (
        <ElevatorCard
          key={elevator.id}
          elevator={elevator}
          onSelect={() => onSelect(elevator)}
        />
      ))}

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/90 backdrop-blur p-3">
        <div className="mx-auto w-full max-w-md">
          <Button
            className="w-full min-h-[52px] text-base font-bold"
            onClick={onFinalize}
            disabled={!allComplete || isFinishing}
          >
            {isFinishing ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-5" />
            )}
            Finalizar orden de trabajo
          </Button>
          {!allComplete && (
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Finaliza la seguridad y el checklist de todos los equipos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ElevatorCard({
  elevator,
  onSelect,
}: {
  elevator: TechnicianElevator;
  onSelect: () => void;
}) {
  const safetyDone = elevator.safety?.status === "COMPLETED";
  const elevatorDone = elevator.status === "COMPLETED";
  const completed = elevator.tasks.filter((t) => t.isCompleted).length;
  const total = elevator.tasks.length;

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm space-y-2">
      <div className="flex items-start gap-2">
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#0066CC]/10 text-[#0066CC] border border-[#0066CC]/20">
          {elevator.internalCode}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-tight truncate">
            {elevator.elevatorName}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {elevator.elevatorType} · {elevator.brand}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Estado:{" "}
        <span
          className={cn(
            "font-semibold",
            elevatorDone
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-foreground"
          )}
        >
          {ELEVATOR_STATUS_LABEL[elevator.status ?? "PENDING"] ?? elevator.status}
        </span>
      </p>

      <div className="grid grid-cols-2 gap-2">
        <StatusIndicator
          label="Seguridad"
          done={safetyDone}
          value={safetyDone ? SAFETY_LABEL.COMPLETED : SAFETY_LABEL.PENDING}
        />
        <StatusIndicator
          label="Mantenimiento"
          done={elevatorDone}
          value={`${completed}/${total}`}
        />
      </div>

      <Button
        type="button"
        className="w-full min-h-[48px] font-bold"
        onClick={onSelect}
      >
        {safetyDone ? (
          <Play className="size-4" />
        ) : (
          <ShieldCheck className="size-4" />
        )}
        {elevatorDone
          ? "Ver equipo"
          : safetyDone
            ? "Continuar"
            : "Iniciar seguridad"}
        <ChevronRight className="size-4 ml-auto" />
      </Button>
    </div>
  );
}