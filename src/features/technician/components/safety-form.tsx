"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  type TechnicianElevator,
  type TechnicianSafetyItem,
} from "../queries";
import { runSync } from "../lib/sync-client";

const RESPONSES = [
  { value: "SI", label: "Sí" },
  { value: "NO", label: "No" },
  { value: "NA", label: "N/A" },
] as const;

function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 0 }
    );
  });
}

const EMPTY_ITEMS: TechnicianSafetyItem[] = [];

export function SafetyForm({
  elevator,
  onBack,
}: {
  elevator: TechnicianElevator;
  onBack: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<TechnicianSafetyItem[]>(
    () => elevator.safety?.items ?? EMPTY_ITEMS
  );

  const allAnswered = items.every((item) => item.response);

  function setResponse(itemId: string, value: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, response: value } : item
      )
    );
    void runSync("saveSafetyItem", { itemId, data: { response: value } });
  }

  function acceptAllAndContinue() {
    startTransition(async () => {
      const results = await Promise.all(
        items.map((item) =>
          runSync("saveSafetyItem", {
            itemId: item.id,
            data: { response: "SI" },
          })
        )
      );
      if (results.some((res) => !res.success)) {
        toast.error("Error", {
          description: "No se pudieron guardar las respuestas.",
        });
        return;
      }
      setItems((prev) =>
        prev.map((item) => ({ ...item, response: "SI" }))
      );

      const geolocation = await getCurrentPosition();
      const res = await runSync("completeElevatorSafety", {
        elevatorId: elevator.id,
        geolocation,
      });
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else {
        toast.error("Error", { description: res.error });
      }
    });
  }

  function handleComplete() {
    if (!allAnswered) {
      toast.error("Checklist incompleto", {
        description: "Responde todas las preguntas del checklist.",
      });
      return;
    }
    startTransition(async () => {
      const geolocation = await getCurrentPosition();
      const res = await runSync("completeElevatorSafety", {
        elevatorId: elevator.id,
        geolocation,
      });
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

      <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs font-semibold leading-snug">
          Debes completar el checklist de seguridad antes de iniciar el
          mantenimiento de {elevator.internalCode}.
        </p>
      </div>

      <div className="flex items-start gap-2">
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#0066CC]/10 text-[#0066CC] border border-[#0066CC]/20">
          {elevator.internalCode}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold leading-tight">
            {elevator.elevatorName}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {elevator.elevatorType} · {elevator.brand}
          </p>
        </div>
      </div>

      <Button
        type="button"
        className="w-full min-h-[52px] text-base font-bold"
        onClick={acceptAllAndContinue}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <CheckCircle2 className="size-5" />
        )}
        Aceptar todos y Continuar
      </Button>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No existe un checklist de seguridad activo para este equipo. Contacta
          con el administrador.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm space-y-2"
            >
              <p className="text-sm font-semibold leading-snug">
                {item.question}
              </p>
              <div className="flex gap-2">
                {RESPONSES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setResponse(item.id, option.value)}
                    className={cn(
                      "flex-1 min-h-[40px] rounded-lg border text-xs font-bold transition-colors",
                      item.response === option.value
                        ? "border-[#0066CC]/40 bg-[#0066CC]/10 text-[#0066CC]"
                        : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full min-h-[48px] font-bold"
        onClick={handleComplete}
        disabled={!allAnswered || isPending}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCheck className="size-4" />
        )}
        Completar seguridad
      </Button>
    </div>
  );
}