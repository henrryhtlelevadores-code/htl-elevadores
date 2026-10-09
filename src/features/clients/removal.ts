import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  clients,
  contracts,
  costCenterContacts,
  costCenters,
  elevatorUnities,
  invoices,
  quotations,
  workOrders,
} from "@/db/index";
import { cancelContractRecords, type DbTransaction } from "@/features/contracts/cancel";

/**
 * Baja de clientes y sedes.
 *
 * - Sin historial (nunca tuvo equipos, contratos, OTs, cotizaciones ni
 *   comprobantes): se borra de verdad, junto con sus contactos.
 * - Con historial: se deshabilita (soft delete) y la baja se propaga para que
 *   no siga apareciendo como algo vigente: equipos fuera de los listados,
 *   contratos anulados (y sus equipos fuera de las rutas), OTs pendientes
 *   canceladas, cotizaciones abiertas inactivas y acceso al portal retirado.
 *   Lo ya ocurrido (OTs en curso o completadas, informes, cotizaciones
 *   aceptadas o rechazadas, comprobantes) se conserva tal cual.
 */

/** Cotizaciones que aún podían cambiar de estado. */
const OPEN_QUOTATION_STATUSES = ["DRAFT", "SENT"];
export const INACTIVE_QUOTATION_STATUS = "INACTIVE";

export type RemovalMode = "deleted" | "disabled";

export interface CostCenterImpact {
  equipment: number;
  activeContracts: number;
  pendingWorkOrders: number;
  openQuotations: number;
  hasPortal: boolean;
}

export interface CostCenterRemoval extends CostCenterImpact {
  mode: RemovalMode;
}

export interface ClientRemoval {
  mode: RemovalMode;
  deletedCostCenters: number;
  disabledCostCenters: number;
  equipment: number;
  activeContracts: number;
  pendingWorkOrders: number;
  openQuotations: number;
  portalsRemoved: number;
}

async function exists(query: Promise<unknown[]>): Promise<boolean> {
  return (await query).length > 0;
}

/** ¿Algún registro de negocio apunta a la sede, aunque esté dado de baja? */
export async function costCenterHasHistory(tx: DbTransaction, costCenterId: string): Promise<boolean> {
  const checks = [
    tx
      .select({ id: elevatorUnities.id })
      .from(elevatorUnities)
      .where(eq(elevatorUnities.costCenterId, costCenterId))
      .limit(1),
    tx.select({ id: contracts.id }).from(contracts).where(eq(contracts.costCenterId, costCenterId)).limit(1),
    tx
      .select({ id: workOrders.id })
      .from(workOrders)
      .where(eq(workOrders.costCenterId, costCenterId))
      .limit(1),
    tx
      .select({ id: quotations.id })
      .from(quotations)
      .where(eq(quotations.costCenterId, costCenterId))
      .limit(1),
    tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.costCenterId, costCenterId)).limit(1),
  ];
  for (const check of checks) {
    if (await exists(check)) return true;
  }
  return false;
}

async function countRows(query: Promise<{ n: number }[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

/** Lo que se vería afectado al deshabilitar la sede. */
export async function costCenterImpact(tx: DbTransaction, costCenterId: string): Promise<CostCenterImpact> {
  const n = sql<number>`count(*)`;
  // En serie: son consultas dentro de una transacción.
  const equipment = await countRows(
    tx
      .select({ n })
      .from(elevatorUnities)
      .where(and(eq(elevatorUnities.costCenterId, costCenterId), isNull(elevatorUnities.deletedAt))),
  );
  const activeContracts = await countRows(
    tx
      .select({ n })
      .from(contracts)
      .where(and(eq(contracts.costCenterId, costCenterId), isNull(contracts.deletedAt))),
  );
  const pendingWorkOrders = await countRows(
    tx
      .select({ n })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.costCenterId, costCenterId),
          eq(workOrders.status, "PENDING"),
          isNull(workOrders.deletedAt),
        ),
      ),
  );
  const openQuotations = await countRows(
    tx
      .select({ n })
      .from(quotations)
      .where(
        and(eq(quotations.costCenterId, costCenterId), inArray(quotations.status, OPEN_QUOTATION_STATUSES)),
      ),
  );
  const center = await tx
    .select({ hasPortal: sql<number>`${costCenters.passwordHash} IS NOT NULL`.mapWith(Boolean) })
    .from(costCenters)
    .where(eq(costCenters.id, costCenterId))
    .limit(1);
  return {
    equipment,
    activeContracts,
    pendingWorkOrders,
    openQuotations,
    hasPortal: Boolean(center[0]?.hasPortal),
  };
}

/** Deshabilita la sede y propaga la baja. Es idempotente. */
async function disableCostCenter(
  tx: DbTransaction,
  costCenterId: string,
  now: number,
): Promise<CostCenterImpact> {
  const impact = await costCenterImpact(tx, costCenterId);

  const activeContracts = await tx
    .select({ id: contracts.id })
    .from(contracts)
    .where(and(eq(contracts.costCenterId, costCenterId), isNull(contracts.deletedAt)));
  for (const contract of activeContracts) {
    await cancelContractRecords(tx, contract.id, now);
  }

  await tx
    .update(workOrders)
    .set({ status: "CANCELLED", deletedAt: now })
    .where(
      and(
        eq(workOrders.costCenterId, costCenterId),
        eq(workOrders.status, "PENDING"),
        isNull(workOrders.deletedAt),
      ),
    );

  await tx
    .update(elevatorUnities)
    .set({ deletedAt: now })
    .where(and(eq(elevatorUnities.costCenterId, costCenterId), isNull(elevatorUnities.deletedAt)));

  await tx
    .update(quotations)
    .set({ status: INACTIVE_QUOTATION_STATUS })
    .where(
      and(eq(quotations.costCenterId, costCenterId), inArray(quotations.status, OPEN_QUOTATION_STATUSES)),
    );

  // Sin credencial y con las sesiones abiertas revocadas: el portal deja de existir.
  await tx
    .update(costCenters)
    .set({
      deletedAt: sql`coalesce(${costCenters.deletedAt}, ${now})`,
      passwordHash: null,
      portalSessionVersion: sql`${costCenters.portalSessionVersion} + 1`,
    })
    .where(eq(costCenters.id, costCenterId));

  return impact;
}

async function purgeCostCenter(tx: DbTransaction, costCenterId: string) {
  await tx.delete(costCenterContacts).where(eq(costCenterContacts.costCenterId, costCenterId));
  await tx.delete(costCenters).where(eq(costCenters.id, costCenterId));
}

/** Borra la sede si no tiene historial; si lo tiene, la deshabilita. */
export async function removeCostCenter(
  tx: DbTransaction,
  costCenterId: string,
  now: number,
): Promise<CostCenterRemoval> {
  if (!(await costCenterHasHistory(tx, costCenterId))) {
    await purgeCostCenter(tx, costCenterId);
    return {
      mode: "deleted",
      equipment: 0,
      activeContracts: 0,
      pendingWorkOrders: 0,
      openQuotations: 0,
      hasPortal: false,
    };
  }
  return { mode: "disabled", ...(await disableCostCenter(tx, costCenterId, now)) };
}

/**
 * Da de baja al cliente: cada sede se borra o se deshabilita según su
 * historial, y el cliente se borra solo si no le queda nada que conservar.
 */
export async function removeClient(tx: DbTransaction, clientId: string, now: number): Promise<ClientRemoval> {
  const result: ClientRemoval = {
    mode: "deleted",
    deletedCostCenters: 0,
    disabledCostCenters: 0,
    equipment: 0,
    activeContracts: 0,
    pendingWorkOrders: 0,
    openQuotations: 0,
    portalsRemoved: 0,
  };

  // También las sedes ya dadas de baja: las que quedaron sin historial se limpian.
  const centers = await tx
    .select({ id: costCenters.id })
    .from(costCenters)
    .where(eq(costCenters.clientId, clientId));
  for (const center of centers) {
    const removal = await removeCostCenter(tx, center.id, now);
    if (removal.mode === "deleted") {
      result.deletedCostCenters++;
      continue;
    }
    result.disabledCostCenters++;
    result.equipment += removal.equipment;
    result.activeContracts += removal.activeContracts;
    result.pendingWorkOrders += removal.pendingWorkOrders;
    result.openQuotations += removal.openQuotations;
    if (removal.hasPortal) result.portalsRemoved++;
  }

  // Cotizaciones del cliente sin sede asignada.
  const openWithoutCenter = await tx
    .update(quotations)
    .set({ status: INACTIVE_QUOTATION_STATUS })
    .where(
      and(
        eq(quotations.clientId, clientId),
        isNull(quotations.costCenterId),
        inArray(quotations.status, OPEN_QUOTATION_STATUSES),
      ),
    )
    .returning({ id: quotations.id });
  result.openQuotations += openWithoutCenter.length;

  const keep =
    result.disabledCostCenters > 0 ||
    (await exists(
      tx.select({ id: quotations.id }).from(quotations).where(eq(quotations.clientId, clientId)).limit(1),
    )) ||
    (await exists(
      tx.select({ id: invoices.id }).from(invoices).where(eq(invoices.clientId, clientId)).limit(1),
    ));

  if (keep) {
    await tx
      .update(clients)
      .set({ deletedAt: sql`coalesce(${clients.deletedAt}, ${now})` })
      .where(eq(clients.id, clientId));
    result.mode = "disabled";
  } else {
    await tx.delete(clients).where(eq(clients.id, clientId));
  }
  return result;
}
