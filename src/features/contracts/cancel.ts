import "server-only";

import { and, eq, gte, inArray, isNull, or } from "drizzle-orm";
import {
  db,
  contracts,
  contractElevators,
  preventiveRouteStops,
  serviceTypes,
  workOrderElevators,
  workOrders,
} from "@/db/index";

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Anula un contrato: borra las OTs preventivas pendientes y futuras de sus
 * equipos, saca esos equipos de las rutas y del contrato, y lo marca
 * CANCELLED. Lo usan la anulación manual y la baja de una sede.
 */
export async function cancelContractRecords(tx: DbTransaction, id: string, now: number) {
  const elevatorRows = await tx
    .select({
      id: contractElevators.id,
      elevatorUnityId: contractElevators.elevatorUnityId,
    })
    .from(contractElevators)
    .where(eq(contractElevators.contractId, id));

  const ceIds = elevatorRows.map((r) => r.id);
  const elevatorIds = elevatorRows.map((r) => r.elevatorUnityId);
  let cancelledWorkOrders = 0;

  if (ceIds.length > 0) {
    const today = new Date().toISOString().slice(0, 10);

    const [prev] = await tx
      .select({ id: serviceTypes.id })
      .from(serviceTypes)
      .where(eq(serviceTypes.code, "PREV"))
      .limit(1);
    const prevServiceTypeId = prev?.id;

    const typeFilter = prevServiceTypeId
      ? or(eq(workOrders.serviceTypeId, prevServiceTypeId), eq(serviceTypes.code, "PREV"))
      : eq(serviceTypes.code, "PREV");

    const futurePending = await tx
      .select({ id: workOrders.id })
      .from(workOrders)
      .innerJoin(workOrderElevators, eq(workOrderElevators.workOrderId, workOrders.id))
      .leftJoin(serviceTypes, eq(serviceTypes.id, workOrders.serviceTypeId))
      .where(
        and(
          inArray(workOrderElevators.elevatorUnityId, elevatorIds),
          eq(workOrders.status, "PENDING"),
          gte(workOrders.scheduledDate, today),
          isNull(workOrders.deletedAt),
          typeFilter,
        ),
      );

    const pendingIds = [...new Set(futurePending.map((r) => r.id))];
    if (pendingIds.length > 0) {
      await tx.update(workOrders).set({ deletedAt: now }).where(inArray(workOrders.id, pendingIds));
    }
    cancelledWorkOrders = pendingIds.length;

    await tx.delete(preventiveRouteStops).where(inArray(preventiveRouteStops.contractElevatorId, ceIds));
    await tx.delete(contractElevators).where(inArray(contractElevators.id, ceIds));
  }

  await tx.update(contracts).set({ status: "CANCELLED", deletedAt: now }).where(eq(contracts.id, id));

  return { unlinkedElevators: ceIds.length, cancelledWorkOrders };
}
