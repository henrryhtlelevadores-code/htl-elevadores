"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getContractElevatorModules,
  getModuleExecutionHistory,
  type ContractElevatorModuleRow,
} from "../actions";
import { buildAnnualPlanCalendar, MONTH_LABELS } from "../constants";
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
  CalendarClock,
  History,
  Loader2,
  Wrench,
} from "lucide-react";

function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("es-PE");
}

interface MaintenancePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractElevatorId: string | null;
  elevatorLabel: string;
}

export function MaintenancePlanDialog({
  open,
  onOpenChange,
  contractElevatorId,
  elevatorLabel,
}: MaintenancePlanDialogProps) {
  const [plan, setPlan] = useState<ContractElevatorModuleRow[]>([]);
  // Ascensor para el que ya se cargó el plan; define el estado de carga.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [historyModule, setHistoryModule] =
    useState<ContractElevatorModuleRow | null>(null);
  const [historyRows, setHistoryRows] = useState<
    Awaited<ReturnType<typeof getModuleExecutionHistory>>
  >([]);

  const isLoading = open && !!contractElevatorId && loadedId !== contractElevatorId;

  useEffect(() => {
    if (!open || !contractElevatorId) return;
    let cancelled = false;
    startTransition(async () => {
      const rows = await getContractElevatorModules(contractElevatorId);
      if (cancelled) return;
      setPlan(rows);
      setLoadedId(contractElevatorId);
    });
    return () => {
      cancelled = true;
    };
  }, [open, contractElevatorId]);

  useEffect(() => {
    if (!historyModule || !contractElevatorId) return;
    let cancelled = false;
    void getModuleExecutionHistory(contractElevatorId, historyModule.moduleId).then((rows) => {
      if (!cancelled) setHistoryRows(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [contractElevatorId, historyModule]);

  // Datos de calendario del contrato, tomados del propio plan.
  const contractTiming = useMemo(() => {
    const first = plan[0];
    return {
      startDate: first ? new Date(first.contractStartDate * 1000) : new Date(),
    };
  }, [plan]);

  /**
   * Calendario real: los 12 meses contados desde el inicio del contrato, con
   * los módulos que tocaría ejecutar en cada visita.
   */
  const annualCalendar = useMemo(
    () =>
      buildAnnualPlanCalendar({
        assigned: plan.map((row) => ({
          id: row.moduleId,
          code: row.moduleCode,
          monthsOfYear: row.monthsOfYear,
          isActive: true,
        })),
        startDate: contractTiming.startDate,
      }),
    [plan, contractTiming]
  );


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border sm:max-w-[680px] text-foreground shadow-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Wrench className="size-4 text-[#0066CC]" />
            Plan de Mantenimiento
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Módulos de{" "}
            <strong className="text-foreground font-mono">{elevatorLabel}</strong>{" "}
            según su tipo de equipo. Al ejecutar un módulo en campo se recalcula
            su próximo vencimiento.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando plan...
          </div>
        ) : (
          <div className="space-y-5 pt-1">
            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-2">
                Calendario real
                <span className="font-normal normal-case tracking-normal text-muted-foreground">
                  Calendario fijo por módulo
                </span>
              </h3>

              {plan.length === 0 ? (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Este tipo de equipo no tiene módulos de mantenimiento activos.
                </p>
              ) : (
                <>
                  <p className="text-[10px] text-muted-foreground">
                    Contrato inicia:{" "}
                    <span className="font-semibold text-foreground/80">
                      {contractTiming.startDate.toLocaleDateString("es-PE", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </p>
                  <ul className="space-y-0.5 rounded-lg border border-border bg-muted/20 px-3 py-2 font-mono text-[10px]">
                    {annualCalendar.map((entry) => (
                      <li
                        key={`${entry.year}-${entry.month}`}
                        className="flex gap-1.5"
                      >
                        <span className="min-w-24 shrink-0 text-muted-foreground">
                          {MONTH_LABELS[entry.month - 1]} {entry.year}:
                        </span>
                        <span className="font-bold text-[#0066CC] dark:text-[#4d9aff]">
                          {entry.isVisitMonth
                            ? entry.codes.join(", ") || "—"
                            : "sin visita"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-foreground/80">
                Módulos del plan ({plan.length})
              </h3>
              {plan.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  No hay módulos activos configurados para este tipo de equipo.
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {plan.map((row) => (
                    <li
                      key={row.moduleId}
                      className="flex flex-wrap items-center gap-2 px-3 py-2.5"
                    >
                      <span className="inline-flex items-center rounded-md border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] font-bold">
                        {row.moduleCode}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                        {row.moduleName}
                      </span>

                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span>Última:</span>
                        <span className="font-mono">{formatDate(row.lastExecutedAt)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <CalendarClock className="size-3 text-muted-foreground" />
                        <span className="font-mono font-semibold">
                          {formatDate(row.nextDueAt)}
                        </span>
                      </div>

                      <span className="basis-full text-[10px] text-muted-foreground">
                        {row.monthsOfYear
                          .split(",")
                          .map((month) => MONTH_LABELS[Number(month) - 1])
                          .join(", ")}
                      </span>

                      <Button
                        variant="ghost"
                        size="icon-xs"
                        title="Ver historial"
                        onClick={() => setHistoryModule(row)}
                      >
                        <History className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        <DialogFooter className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs border-border"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      {/* El historial detallado se habilita con la tabla de ejecuciones (pendiente). */}
      <Dialog
        open={!!historyModule}
        onOpenChange={(o) => !o && setHistoryModule(null)}
      >
        <DialogContent className="bg-card border-border sm:max-w-[420px] text-foreground shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <History className="size-4" />
              Historial de {historyModule?.moduleCode}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1 text-xs text-muted-foreground">
            <p>
              Última ejecución registrada:{" "}
              <span className="font-mono font-semibold text-foreground">
                {formatDate(historyModule?.lastExecutedAt)}
              </span>
            </p>
            {historyRows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center">
                No hay ejecuciones registradas para este módulo.
              </p>
            ) : (
              <ul className="max-h-52 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {historyRows.map((execution) => (
                  <li key={execution.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {formatDate(execution.executedAt)}
                    </span>
                    <span className="flex-1 text-foreground">
                      OT {execution.workOrderId}
                    </span>
                    {execution.technicianId && (
                      <span className="text-[10px] text-muted-foreground">
                        Técnico {execution.technicianId}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter className="pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHistoryModule(null)}
              className="text-xs border-border"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
