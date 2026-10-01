"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getCostCenterCalendarWorkOrders } from "../actions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type CalendarOrder = Awaited<ReturnType<typeof getCostCenterCalendarWorkOrders>>[number];
type Range = "current-month" | "next-month" | "all";

function formatDate(date: string | null) {
  if (!date) return "Fecha no programada";
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function getRange(range: Range) {
  const now = new Date();
  if (range === "all") return { from: "0000-01-01", to: "9999-12-31" };
  const offset = range === "next-month" ? 1 : 0;
  const fromDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const toDate = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: iso(fromDate), to: iso(toDate) };
}

function serviceGroup(order: CalendarOrder) {
  if (order.serviceTypeCode === "PREV") return "PREVENTIVE";
  if (order.serviceTypeCategory === "EMERGENCIA" || order.serviceTypeCode?.startsWith("EMER")) return "EMERGENCY";
  if (order.serviceTypeCategory === "MANTENIMIENTO" || order.serviceTypeCode?.startsWith("CORR")) return "CORRECTIVE";
  if (order.serviceTypeCategory === "MODERNIZACION") return "MODERNIZATION";
  return "PROJECT";
}

function groupColor(group: string) {
  return { PREVENTIVE: "#16A34A", CORRECTIVE: "#2563EB", EMERGENCY: "#DC2626", MODERNIZATION: "#7C3AED", PROJECT: "#EA580C" }[group] ?? "#6B7280";
}

export function CostCenterCalendar({ costCenterId }: { costCenterId: string }) {
  const [range, setRange] = useState<Range>("current-month");
  const [orders, setOrders] = useState<CalendarOrder[]>([]);
  const [isPending, startTransition] = useTransition();
  const { from, to } = getRange(range);

  useEffect(() => {
    startTransition(async () => setOrders(await getCostCenterCalendarWorkOrders(costCenterId, from, to, "ALL", "ACTIVE")));
  }, [costCenterId, from, to]);

  const grouped = useMemo(() => orders.reduce<Record<string, CalendarOrder[]>>((groups, order) => {
    const key = serviceGroup(order);
    (groups[key] ??= []).push(order);
    return groups;
  }, {}), [orders]);

  const sections = [
    ["PREVENTIVE", "Preventivo"],
    ["CORRECTIVE", "Correctivo"],
    ["EMERGENCY", "Emergencia"],
    ["MODERNIZATION", "Modernización"],
    ["PROJECT", "Proyecto"],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2">
        {([["current-month", "Este mes"], ["next-month", "Próximo mes"], ["all", "Todas"]] as const).map(([value, label]) => (
          <Button key={value} type="button" size="sm" variant={range === value ? "default" : "outline"} onClick={() => setRange(value)} className="min-h-10 text-xs">
            {label}
          </Button>
        ))}
      </div>

      {isPending ? <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div> : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No hay órdenes de trabajo pendientes.</div>
      ) : sections.map(([key, title]) => {
        const items = grouped[key] ?? [];
        if (items.length === 0) return null;
        const color = groupColor(key);
        return <section key={key} className="space-y-2"><h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide" style={{ color }}><span className="size-2 rounded-full" style={{ backgroundColor: color }} />{title} ({items.length})</h2><div className="space-y-2">{items.map((order) => <article key={order.id} className="rounded-xl border border-border bg-card p-4 shadow-xs" style={{ borderLeftColor: color, borderLeftWidth: 4 }}><div className="flex items-start justify-between gap-3"><div><span className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs font-bold">{order.otNumber}</span><p className="mt-2 text-xs font-semibold text-foreground">📅 {formatDate(order.scheduledDate)} · {order.scheduledTime ?? "Sin hora"}</p></div><span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">{order.status === "IN_PROGRESS" ? "En curso" : "Pendiente"}</span></div><p className="mt-2 text-xs text-muted-foreground">🏢 Centro de costo actual</p><p className="mt-1 text-xs text-muted-foreground">🔧 Equipo asignado</p>{order.technicianName && <p className="mt-1 text-xs text-muted-foreground">👤 {order.technicianName}</p>}</article>)}</div></section>;
      })}

      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground"><span className="text-emerald-600">● Preventivo</span><span className="text-blue-600">● Correctivo</span><span className="text-red-600">● Emergencia</span><span className="text-violet-600">● Modernización</span><span className="text-orange-600">● Proyecto</span></div>
    </div>
  );
}
