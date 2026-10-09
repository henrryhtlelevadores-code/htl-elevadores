"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ClientRemoval, CostCenterRemoval } from "../removal";

type PreviewResult<T> = { success: true; removal: T } | { success: false; error?: string };

/** Pide al servidor la vista previa de la baja cuando se abre el diálogo. */
export function useRemovalPreview<T>(id: string | null, load: (id: string) => Promise<PreviewResult<T>>) {
  const [state, setState] = useState<{ id: string; removal: T | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    load(id)
      .then((res) => {
        if (cancelled) return;
        setState(
          res.success
            ? { id, removal: res.removal, error: null }
            : { id, removal: null, error: res.error ?? "No se pudo revisar la baja." }
        );
      })
      .catch(() => {
        if (!cancelled) setState({ id, removal: null, error: "No se pudo revisar la baja." });
      });
    return () => {
      cancelled = true;
    };
  }, [id, load]);

  const current = id && state?.id === id ? state : null;
  return { removal: current?.removal ?? null, error: current?.error ?? null, loading: Boolean(id) && !current };
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

interface Effects {
  deletedCostCenters?: number;
  disabledCostCenters?: number;
  equipment: number;
  activeContracts: number;
  pendingWorkOrders: number;
  openQuotations: number;
  portals: number;
}

function effectLines(e: Effects): string[] {
  const lines: string[] = [];
  if (e.disabledCostCenters) lines.push(`${plural(e.disabledCostCenters, "sede se deshabilitará", "sedes se deshabilitarán")}.`);
  if (e.deletedCostCenters) lines.push(`${plural(e.deletedCostCenters, "sede sin historial se eliminará", "sedes sin historial se eliminarán")}.`);
  if (e.equipment) lines.push(`${plural(e.equipment, "equipo dejará", "equipos dejarán")} de mostrarse en Equipos.`);
  if (e.activeContracts)
    lines.push(`${plural(e.activeContracts, "contrato se anulará", "contratos se anularán")} y sus equipos saldrán de las rutas.`);
  if (e.pendingWorkOrders) lines.push(`${plural(e.pendingWorkOrders, "OT pendiente se cancelará", "OTs pendientes se cancelarán")}.`);
  if (e.openQuotations)
    lines.push(`${plural(e.openQuotations, "cotización abierta pasará", "cotizaciones abiertas pasarán")} a inactiva.`);
  if (e.portals) lines.push(e.portals === 1 ? "Se retirará el acceso al portal." : `Se retirará el acceso a ${e.portals} portales.`);
  return lines;
}

/**
 * Explica qué hará la baja antes de confirmarla: borrar del todo (sin
 * historial) o deshabilitar y propagar (con historial).
 */
export function RemovalSummary({
  kind,
  removal,
  loading,
  error,
}: {
  kind: "client" | "costCenter";
  removal: ClientRemoval | CostCenterRemoval | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Revisando lo que está vinculado…
      </div>
    );
  }
  if (error) return <p className="text-xs text-red-600 dark:text-red-400">{error}</p>;
  if (!removal) return null;

  const subject = kind === "client" ? "El cliente" : "La sede";

  if (removal.mode === "deleted") {
    return (
      <p className="text-xs text-muted-foreground">
        {subject} no tiene equipos, contratos, OTs, cotizaciones ni comprobantes. Se eliminará definitivamente
        {kind === "client" ? ", junto con sus sedes y contactos." : ", junto con sus contactos."} No se puede deshacer.
      </p>
    );
  }

  const lines = effectLines(
    "portalsRemoved" in removal
      ? { ...removal, portals: removal.portalsRemoved }
      : { ...removal, portals: removal.hasPortal ? 1 : 0 }
  );

  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <p>
        {subject} tiene historial, así que se <strong className="text-foreground">deshabilitará</strong> en vez de
        borrarse.
      </p>
      {lines.length > 0 && (
        <ul className="list-disc space-y-1 pl-4">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <p>Se conservan las OTs en curso o completadas, los informes, las cotizaciones cerradas y los comprobantes.</p>
    </div>
  );
}
