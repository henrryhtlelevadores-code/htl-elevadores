"use client";

import { Building2, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ClientHeaderCardCostCenter {
  name: string;
  address: string | null;
  district: string | null;
  contactName: string | null;
  contactPhone: string | null;
}

export interface ClientHeaderCardProps {
  costCenter: ClientHeaderCardCostCenter;
  hasStopped: boolean;
  stoppedCount: number;
  /** Última visita ya formateada, p. ej. "12 mar 2026". */
  lastVisitLabel: string;
}

/**
 * Card de identificación del cliente dentro del portal. El nombre nunca se
 * recorta con `truncate`: usa `line-clamp-2` para envolver en hasta dos líneas
 * sin romper el layout.
 */
export function ClientHeaderCard({
  costCenter,
  hasStopped,
  stoppedCount,
  lastVisitLabel,
}: ClientHeaderCardProps) {
  const address =
    [costCenter.address, costCenter.district].filter(Boolean).join(", ") ||
    "Dirección no registrada";

  return (
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 sm:size-12">
          <Building2 className="size-5 text-primary sm:size-6" />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 text-lg font-bold leading-tight sm:text-2xl">
            {costCenter.name}
          </h1>

          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-2">{address}</span>
          </p>

          {(costCenter.contactName || costCenter.contactPhone) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted-foreground">
              <User className="size-3.5 shrink-0" />
              <span>{costCenter.contactName ?? "Contacto"}</span>
              {costCenter.contactPhone && (
                <>
                  <span aria-hidden>·</span>
                  <span className="font-mono">{costCenter.contactPhone}</span>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <span
          className={cn(
            "inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
            hasStopped
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}
        >
          {hasStopped ? (
            `⚠ ${stoppedCount} equipo(s) requiere(n) atención`
          ) : (
            <>
              ✅ Mantenimiento al día
              <span className="font-normal">
                Última: {lastVisitLabel} · Próxima: —
              </span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}