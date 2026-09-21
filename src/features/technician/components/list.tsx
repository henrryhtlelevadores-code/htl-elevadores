"use client";

import Link from "next/link";
import {
  type TechnicianWorkOrder,
} from "../queries";
import {
  ClipboardList,
  MapPin,
  Building2,
  CalendarDays,
  Layers3,
  PencilRuler,
  Play,
  ShieldCheck,
} from "lucide-react";
import { cn } from "cn";

const STATUS_STYLES: Record<string, string> = {
  PENDING:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  IN_PROGRESS:
    "bg-blue-500/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20",
  COMPLETED:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-500/10 text-red-500 border-red-500/20",
  NORMAL: "bg-blue-500/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20",
  LOW: "bg-muted text-muted-foreground border-border",
};

function formatDateTime(date: string | null, time?: string | null): string {
  if (!date) return "Sin programar";
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
  return time ? `${base} · ${time}` : base;
}

export function TechnicianWorkOrderList({
  technicianName,
  workOrders,
}: {
  technicianName: string;
  workOrders: TechnicianWorkOrder[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {workOrders.length === 0
          ? "No tienes órdenes pendientes asignadas."
          : `Tienes ${workOrders.length} orden(es) pendiente(s).`}
      </p>

      {workOrders.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 py-14 text-center px-6">
          <ShieldCheck className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold">Estás al día</p>
          <p className="text-xs text-muted-foreground mt-1">
            Las nuevas órdenes asignadas a {technicianName} aparecerán aquí.
          </p>
        </div>
      )}

      {workOrders.map((wo) => (
        <Link
          key={wo.id}
          href={`/technician/work-orders/${wo.id}`}
          className="block rounded-2xl border border-border bg-card shadow-sm transition-colors active:bg-muted/60 min-h-[150px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <span className="flex items-center gap-1.5 font-mono text-xs font-bold truncate">
              <ClipboardList className="size-3.5 text-[#0066CC] shrink-0" />
              {wo.otNumber}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {wo.priority && PRIORITY_STYLES[wo.priority] && (
                <span
                  className={cn(
                    "inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                    PRIORITY_STYLES[wo.priority]
                  )}
                >
                  {wo.priority}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                  STATUS_STYLES[wo.status || "PENDING"] ?? STATUS_STYLES.PENDING
                )}
              >
                {wo.status === "IN_PROGRESS"
                  ? "En curso"
                  : wo.status === "COMPLETED"
                    ? "Completada"
                    : wo.status === "CANCELLED"
                      ? "Cancelada"
                      : "Pendiente"}
              </span>
            </div>
          </div>

          <div className="px-4 py-3 space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold leading-snug">
              <Building2 className="size-4 text-[#0066CC] shrink-0" />
              <span className="truncate">{wo.client_name}</span>
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{wo.cost_center_name}</span>
            </p>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <CalendarDays className="size-3.5 text-[#0066CC] shrink-0" />
                {formatDateTime(wo.scheduledDate, wo.scheduledTime)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers3 className="size-3.5 shrink-0" />
                {wo.equipmentCount} equipo(s)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 border-t border-border px-4 py-2 text-[11px] font-semibold text-[#0066CC]">
            {wo.status === "IN_PROGRESS" ? (
              <>
                <Play className="size-3" /> Continuar
              </>
            ) : (
              <>
                <PencilRuler className="size-3" /> Iniciar trabajo
              </>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}