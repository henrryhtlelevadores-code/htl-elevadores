import type { RouteStopWithRelations } from "./actions";

/**
 * Clave de visita: `visit_group_id`.
 * Fallback legacy para stops sin grupo: (hora + sede).
 */
export function visitKeyOfStop(stop: RouteStopWithRelations): string {
  return stop.visitGroupId ?? `legacy:${stop.plannedTime}|${stop.costCenterId}`;
}

export function isContractInactive(stop: RouteStopWithRelations): boolean {
  return stop.contractDeletedAt !== null || stop.contractStatus !== "ACTIVE";
}

/** Agrupa las paradas por visita (1 grupo = 1 OT al generar). */
export function groupStopsByVisit(
  stops: RouteStopWithRelations[]
): RouteStopWithRelations[][] {
  const map = new Map<string, RouteStopWithRelations[]>();
  for (const stop of stops) {
    const key = visitKeyOfStop(stop);
    const list = map.get(key) ?? [];
    list.push(stop);
    map.set(key, list);
  }
  return [...map.values()];
}
