"use client";

import {
  useMemo,
  useState,
} from "react";
import type { TechnicianWorkOrder, TechnicianEmergency } from "../server/queries";
import { toISODate, nextFourteenDays, getDateLabel, formatShortHuman } from "../lib/dates";
import { DateCarousel } from "./date-carousel";
import { TypeFilters, type TypeFilterOption } from "./type-filters";
import { EmergencyBanner } from "./emergency-banner";
import { WorkOrderCard } from "./work-order-card";
import { CalendarOff, ChevronDown, Layers3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<string, string> = {
  PREV: "Preventivo",
  CORR: "Correctivo",
};

function typeLabel(code: string | null): string {
  if (!code) return "Sin tipo";
  if (code.toUpperCase().startsWith("EMER")) return "Emergencia";
  return TYPE_LABELS[code] ?? code;
}

type DateGroup = {
  key: string | null;
  pending: TechnicianWorkOrder[];
};

const ACTIVE_STATUSES = new Set(["IN_PROGRESS", "PAUSED"]);

export function TechnicianView({
  workOrders,
  emergencies,
  technicianName,
}: {
  workOrders: TechnicianWorkOrder[];
  emergencies: TechnicianEmergency[];
  technicianName: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(() =>
    toISODate(new Date())
  );
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [showCompletedToday, setShowCompletedToday] = useState(false);

  const days = useMemo(() => nextFourteenDays(), []);

  const typeOptions = useMemo<TypeFilterOption[]>(() => {
    const seen = new Map<string, string>();
    for (const wo of workOrders) {
      const code = wo.service_type_code;
      if (!code) continue;
      seen.set(code, typeLabel(code));
    }
    return [...seen.entries()].map(([code, label]) => ({ code, label }));
  }, [workOrders]);

  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const wo of workOrders) {
      if (!wo.scheduledDate) continue;
      if (wo.status === "COMPLETED" || wo.status === "CANCELLED") continue;
      counts.set(wo.scheduledDate, (counts.get(wo.scheduledDate) ?? 0) + 1);
    }
    return counts;
  }, [workOrders]);

  const typeFiltered = useMemo(() => {
    return selectedTypes.size === 0
      ? workOrders
      : workOrders.filter((wo) =>
          selectedTypes.has(wo.service_type_code ?? "")
        );
  }, [workOrders, selectedTypes]);

  const inProgress = useMemo(
    () => typeFiltered.filter((wo) => ACTIVE_STATUSES.has(wo.status ?? "")),
    [typeFiltered]
  );

  const visiblePending = useMemo(() => {
    const dateFiltered =
      selectedDate === null
        ? typeFiltered
        : typeFiltered.filter((wo) => wo.scheduledDate === selectedDate);
    return dateFiltered.filter(
      (wo) =>
        wo.status !== "COMPLETED" &&
        wo.status !== "CANCELLED" &&
        !ACTIVE_STATUSES.has(wo.status ?? "")
    );
  }, [selectedDate, typeFiltered]);

  const completedToday = useMemo(() => {
    if (selectedDate !== toISODate(new Date())) return [];
    return typeFiltered.filter(
      (wo) => wo.status === "COMPLETED" && wo.scheduledDate === selectedDate
    );
  }, [selectedDate, typeFiltered]);

  const groups = useMemo<DateGroup[]>(() => {
    const byDate = new Map<string | null, DateGroup>();
    for (const wo of visiblePending) {
      const key = wo.scheduledDate ?? null;
      let group = byDate.get(key);
      if (!group) {
        group = { key, pending: [] };
        byDate.set(key, group);
      }
      group.pending.push(wo);
    }
    const sortByTime = (a: TechnicianWorkOrder, b: TechnicianWorkOrder) =>
      (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "");
    const list = [...byDate.values()];
    for (const group of list) {
      group.pending.sort(sortByTime);
    }
    list.sort((a, b) => {
      if (a.key === null) return 1;
      if (b.key === null) return -1;
      return a.key.localeCompare(b.key);
    });
    return list;
  }, [visiblePending]);

  const hasAnyOrders = workOrders.some(
    (wo) => wo.status !== "COMPLETED" && wo.status !== "CANCELLED"
  );
  const nothingToShow =
    visiblePending.length === 0 &&
    inProgress.length === 0 &&
    completedToday.length === 0;

  function toggleType(code: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div className="technician-view space-y-3">
      {emergencies.length > 0 && (
        <EmergencyBanner emergencies={emergencies} />
      )}

      <DateCarousel
        days={days}
        selectedDate={selectedDate}
        counts={countsByDate}
        onSelect={(iso) =>
          setSelectedDate((prev) => (prev === iso ? null : iso))
        }
      />

      <TypeFilters
        options={typeOptions}
        selected={selectedTypes}
        onToggle={toggleType}
      />

      {inProgress.length > 0 && (
        <section className="space-y-2 border-t border-border pt-3">
          <SectionHeading title="En curso" count={inProgress.length} />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {inProgress.map((wo) => (
              <WorkOrderCard key={wo.id} wo={wo} />
            ))}
          </div>
        </section>
      )}

      {/* Pendientes agrupadas por fecha; las OTs en curso ya están arriba. */}
      <div
        key={`${selectedDate ?? "all"}-${[...selectedTypes].sort().join(",")}`}
        className="space-y-4 animate-in fade-in duration-200"
      >
        {nothingToShow ? (
          <EmptyState
            hasAnyOrders={hasAnyOrders}
            hasDate={selectedDate !== null}
            hasTypes={selectedTypes.size > 0}
            technicianName={technicianName}
            onClearDate={() => setSelectedDate(null)}
            onClearTypes={() => setSelectedTypes(new Set())}
          />
        ) : (
          groups.map((group) => (
            <section key={group.key ?? "__no-date__"}>
              <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
                <h2 className="text-sm font-black uppercase tracking-wide">
                  {group.key === null ? (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <CalendarOff className="size-3.5" />
                      Sin fecha
                    </span>
                  ) : (
                    <>
                      {getDateLabel(group.key)}
                      <span className="ml-1 text-[10px] font-semibold lowercase text-muted-foreground">
                        {formatShortHuman(group.key)}
                      </span>
                    </>
                  )}
                </h2>
                <span className="text-[10px] font-semibold text-muted-foreground">
                  {group.pending.length} OT{group.pending.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.pending.map((wo) => (
                  <WorkOrderCard key={wo.id} wo={wo} />
                ))}
              </div>

            </section>
          ))
        )}
      </div>

      {completedToday.length > 0 && (
        <section className="border-t border-border pt-3">
          <button
            type="button"
            className="flex min-h-10 w-full items-center justify-between gap-2 px-1 text-left"
            onClick={() => setShowCompletedToday((value) => !value)}
            aria-expanded={showCompletedToday}
          >
            <span className="text-sm font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              ✓ Completadas hoy ({completedToday.length})
            </span>
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${showCompletedToday ? "rotate-180" : ""}`}
            />
          </button>
          {showCompletedToday && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {completedToday.map((wo) => (
                <WorkOrderCard key={wo.id} wo={wo} readOnly />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <span className="h-px flex-1 bg-border" />
      <h2 className="text-sm font-black uppercase tracking-wide text-[#0066CC]">
        {title}
      </h2>
      <span className="text-[10px] font-semibold text-muted-foreground">{count} OT{count > 1 ? "s" : ""}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function EmptyState({
  hasAnyOrders,
  hasDate,
  hasTypes,
  technicianName,
  onClearDate,
  onClearTypes,
}: {
  hasAnyOrders: boolean;
  hasDate: boolean;
  hasTypes: boolean;
  technicianName: string;
  onClearDate: () => void;
  onClearTypes: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-10 px-6 text-center space-y-3">
      {hasAnyOrders ? (
        <CalendarOff className="size-10 text-muted-foreground/40" />
      ) : (
        <ShieldCheck className="size-10 text-muted-foreground/40" />
      )}
      <p className="text-sm font-semibold">
        {hasAnyOrders
          ? hasDate
            ? "No tienes órdenes para este día."
            : "No hay órdenes con los filtros seleccionados."
          : "Estás al día"}
      </p>
      <p className="text-xs text-muted-foreground">
        {hasAnyOrders
          ? "Cambia el día o quita los filtros para ver todo lo programado."
          : `Las nuevas órdenes asignadas a ${technicianName} aparecerán aquí.`}
      </p>

      {hasAnyOrders && (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {hasDate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearDate}
              className="min-h-10"
            >
              <Layers3 className="size-4" />
              Ver todas
            </Button>
          )}
          {hasTypes && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearTypes}
              className="min-h-10"
            >
              Quitar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
