import Link from "next/link";
import {
  type TechnicianWorkOrder,
} from "../queries";
import {
  Clock,
  MapPin,
  Phone,
  Play,
  ClipboardList,
  CheckCircle2,
  PencilRuler,
  Navigation,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

const TYPE_BORDER: Record<string, string> = {
  PREV: "bg-emerald-500",
  CORR: "bg-amber-500",
  EMERG: "bg-red-500",
};

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
  PAUSED:
    "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  COMPLETED:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

export function typeColorKey(code: string | null): string {
  if (!code) return "CORR";
  if (code.toUpperCase().startsWith("EMER")) return "EMERG";
  if (code.toUpperCase() === "PREV") return "PREV";
  return "CORR";
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  PAUSED: "Pausada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};

export function WorkOrderCard({
  wo,
  readOnly = false,
}: {
  wo: TechnicianWorkOrder;
  readOnly?: boolean;
}) {
  const typeKey = typeColorKey(wo.service_type_code);
  const status = wo.status || "PENDING";
  const detailHref = `/technician/work-orders/${wo.id}`;
  const mapHref = wo.cost_center_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${wo.cost_center_address}`
      )}`
    : null;
  const isDone = status === "COMPLETED";

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          TYPE_BORDER[typeKey] ?? "bg-[#0066CC]"
        )}
      />

      {readOnly ? (
        <div className="block px-4 pt-3 pb-2 pl-5">
          <CardContent wo={wo} typeKey={typeKey} status={status} />
        </div>
      ) : (
        <Link
          href={detailHref}
          className="block px-4 pt-3 pb-2 pl-5 active:bg-muted/60"
        >
          <CardContent wo={wo} typeKey={typeKey} status={status} />
        </Link>
      )}

      {!readOnly && (
        <div className="flex items-center gap-1 border-t border-border px-2 py-1.5 pl-5">
          <Button
            render={<Link href={detailHref} />}
            nativeButton={false}
            size="sm"
            className="min-w-0 flex-1 min-h-11 font-bold"
          >
            {isDone ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : status === "IN_PROGRESS" || status === "PAUSED" ? (
              <PencilRuler className="size-4 shrink-0" />
            ) : (
              <Play className="size-4 shrink-0" />
            )}
            <span className="truncate">
              {isDone
                ? "Ver detalle"
                : status === "IN_PROGRESS" || status === "PAUSED"
                  ? "Continuar"
                  : "Iniciar"}
            </span>
          </Button>

          {wo.cost_center_phone && (
            <a
              href={`tel:${wo.cost_center_phone}`}
              aria-label="Llamar al punto de servicio"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
            >
              <Phone className="size-4" />
            </a>
          )}
          {mapHref && (
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir en el mapa"
              className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
            >
              <Navigation className="size-4" />
            </a>
          )}
        </div>
      )}
    </article>
  );
}

function CardContent({
  wo,
  typeKey,
  status,
}: {
  wo: TechnicianWorkOrder;
  typeKey: string;
  status: string;
}) {
  return (
    <>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            {wo.scheduledTime ?? "Sin hora"}
          </span>
          {wo.service_type_name && (
            <span
              className={cn(
                "ml-auto inline-flex max-w-[52%] min-w-0 truncate rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase sm:max-w-none",
                TYPE_BADGE[typeKey] ?? "border-[#0066CC]/20 bg-[#0066CC]/10 text-[#0066CC]"
              )}
            >
              {wo.service_type_name}
            </span>
          )}
          <span
            className={cn(
              "inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase",
              STATUS_BADGE[status] ?? STATUS_BADGE.PENDING
            )}
          >
            {STATUS_LABELS[status] ?? status}
          </span>
        </div>

        <p className="mt-2 flex min-w-0 items-center gap-1.5 font-mono text-xs font-bold text-[#0066CC]">
          <ClipboardList className="size-3.5 shrink-0" />
          <span className="truncate">{wo.otNumber}</span>
        </p>
        <h3 className="mt-1 text-sm font-semibold leading-snug break-words">
          {wo.cost_center_name}
        </h3>
        {wo.cost_center_address && (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{wo.cost_center_address}</span>
          </p>
        )}
        <p className="mt-1 truncate text-[10px] text-muted-foreground">
          {wo.client_name}
          {wo.equipmentCount > 0 && ` · ${wo.equipmentCount} equipo(s)`}
        </p>
    </>
  );
}
