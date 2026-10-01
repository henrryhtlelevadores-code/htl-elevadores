import Link from "next/link";
import {
  type TechnicianWorkOrderExecution,
} from "../queries";
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Cog,
  Loader2,
  MapPin,
  Navigation,
  Play,
  Tag,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

const TYPE_BADGE: Record<string, string> = {
  PREV: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  CORR: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  EMERG: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  IN_PROGRESS:
    "bg-blue-500/10 text-[#0066CC] dark:text-blue-400 border-[#0066CC]/20",
  COMPLETED:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

function typeColorKey(code: string | null): string {
  if (!code) return "CORR";
  const upper = code.toUpperCase();
  if (upper.startsWith("EMER")) return "EMERG";
  if (upper === "PREV") return "PREV";
  return "CORR";
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

function formatSchedule(
  scheduledDate: string | null,
  scheduledTime: string | null
): string {
  if (!scheduledDate) return "Sin programar";
  const [y, m, d] = scheduledDate.split("-").map(Number);
  const base = new Date(y, m - 1, d).toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return scheduledTime ? `${base} · ${scheduledTime} h` : base;
}

function mapsUrl(
  address: string | null,
  latitude: number | null,
  longitude: number | null
): string | null {
  if (latitude !== null && longitude !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${latitude},${longitude}`
    )}`;
  }
  if (!address) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address
  )}`;
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
          <span className="text-[#0066CC]">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmergencyPreviewBanner({
  serviceName,
  slaMins,
  remainingLabel,
}: {
  serviceName: string | null;
  slaMins: number | null;
  remainingLabel: string | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-600 to-red-700 p-4 text-white shadow-lg">
      <span className="absolute right-3 top-3 flex size-2.5 animate-pulse rounded-full bg-white/90" />
      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest">
        <AlertTriangle className="size-4" />
        {serviceName || "Emergencia"}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5">
          SLA {slaMins ?? "—"} min
        </span>
        {remainingLabel && (
          <span className="tabular-nums opacity-90">En {remainingLabel}</span>
        )}
      </div>
    </div>
  );
}

export function TechnicianOrderPreview({
  workOrder,
  isPending,
  onStart,
  slaRemainingLabel,
}: {
  workOrder: TechnicianWorkOrderExecution;
  isPending: boolean;
  onStart: () => void;
  slaRemainingLabel?: string | null;
}) {
  const serviceType = workOrder.serviceType;
  const typeKey = typeColorKey(serviceType?.code ?? null);
  const status = workOrder.status || "PENDING";
  const costCenter = workOrder.costCenter;

  const isEmergency =
    serviceType?.category === "EMERGENCIA" ||
    Boolean(serviceType?.code?.toUpperCase().startsWith("EMER"));
  const isCorrective =
    serviceType?.category === "MANTENIMIENTO" &&
    Boolean(serviceType?.code?.toUpperCase().startsWith("CORR"));
  const showProblem = isEmergency || isCorrective;

  const mapHref = mapsUrl(
    costCenter?.address ?? null,
    costCenter?.latitude ?? null,
    costCenter?.longitude ?? null
  );

  return (
    <div className="space-y-3 pb-4">
      {isEmergency && (
        <EmergencyPreviewBanner
          serviceName={serviceType?.name ?? null}
          slaMins={serviceType?.defaultSlaMins ?? null}
          remainingLabel={slaRemainingLabel ?? null}
        />
      )}

      {/* Header (OT + estado) */}
      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-sm font-bold">
            <ClipboardList className="size-4 text-[#0066CC]" />
            {workOrder.otNumber}
          </span>
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
              STATUS_BADGE[status] ?? STATUS_BADGE.PENDING
            )}
          >
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {workOrder.cost_center_name}
        </p>
      </section>

      {/* Tipo de servicio + programación */}
      <Section icon={<Tag className="size-4" />} title="Servicio">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
              TYPE_BADGE[typeKey] ?? "bg-[#0066CC]/10 text-[#0066CC] border-[#0066CC]/20"
            )}
          >
            {serviceType?.name ?? "Sin tipo"}
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0 text-[#0066CC]" />
          {formatSchedule(workOrder.scheduledDate, workOrder.scheduledTime)}
        </p>
      </Section>

      {/* Problema reportado (correctivos y emergencias) */}
      {showProblem && (
        <Section icon={<AlertTriangle className="size-4" />} title="Problema reportado">
          <p
            className={cn(
              "text-sm leading-relaxed",
              !workOrder.description && "text-muted-foreground italic"
            )}
          >
            {workOrder.description?.trim().length
              ? workOrder.description
              : "Sin descripción registrada"}
          </p>
        </Section>
      )}

      {/* Ubicación + botón mapa */}
      {costCenter && (
        <Section
          icon={<MapPin className="size-4" />}
          title="Ubicación"
          action={
            mapHref && (
              <Button
                render={<Link href={mapHref} target="_blank" />}
                variant="outline"
                size="sm"
                nativeButton={false}
                className="min-h-10 gap-1.5 font-semibold"
              >
                <Navigation className="size-3.5" />
                Mapa
              </Button>
            )
          }
        >
          <p className="text-sm font-semibold">{costCenter.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {costCenter.address}
            {costCenter.district ? `, ${costCenter.district}` : ""}
          </p>
        </Section>
      )}

      {/* Equipo(s) */}
      {workOrder.elevators.length > 0 && (
        <Section
          icon={<Cog className="size-4" />}
          title={`Equipo${workOrder.elevators.length > 1 ? "s" : ""}`}
        >
          <div className="divide-y divide-border">
            {workOrder.elevators.map((elevator) => (
              <div key={elevator.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold rounded-md bg-muted border border-border px-1.5 py-0.5">
                    {elevator.internalCode ?? "—"}
                  </span>
                  <p className="text-sm font-semibold truncate">
                    {elevator.elevatorName}
                  </p>
                </div>
                {(elevator.elevatorType || elevator.brand) && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {elevator.elevatorType}
                    {elevator.elevatorType && elevator.brand && (
                      <span aria-hidden>·</span>
                    )}
                    {elevator.brand && <span>{elevator.brand}</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Botón Iniciar */}
      <Button
        className="w-full min-h-[52px] text-base font-bold"
        onClick={onStart}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Play className="size-5" />
        )}
        Iniciar trabajo
      </Button>
    </div>
  );
}
