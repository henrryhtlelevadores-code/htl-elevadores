/**
 * Aplica la regla de baja actual a los clientes y sedes que se eliminaron
 * antes de que existiera (cuando eliminar solo marcaba deleted_at):
 *
 *   - sin historial (equipos, contratos, OTs, cotizaciones, comprobantes):
 *     se borran de verdad, con sus contactos;
 *   - con historial: siguen deshabilitados y la baja se propaga (equipos fuera
 *     de los listados, contratos anulados y fuera de las rutas, OTs pendientes
 *     canceladas, cotizaciones abiertas inactivas, portal retirado).
 *
 * Por defecto NO escribe: ejecuta cada baja en una transacción que se
 * deshace y muestra qué haría. Con `--apply` la confirma. Es idempotente.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/cleanup-removed-clients.ts
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/cleanup-removed-clients.ts --apply
 *
 * (`--conditions=react-server` permite importar los módulos `server-only`.)
 */
import { and, isNotNull, isNull, eq } from "drizzle-orm";
import { db, clients, costCenters } from "../src/db/index";
import { removeClient, removeCostCenter } from "../src/features/clients/removal";
import type { DbTransaction } from "../src/features/contracts/cancel";

const apply = process.argv.includes("--apply");

class DryRun extends Error {}

async function run<T>(work: (tx: DbTransaction, now: number) => Promise<T>): Promise<T> {
  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      result = await work(tx, Math.floor(Date.now() / 1000));
      if (!apply) throw new DryRun();
    });
  } catch (error) {
    if (!(error instanceof DryRun)) throw error;
  }
  return result as T;
}

async function main() {
  console.log(apply ? "Aplicando cambios.\n" : "Simulación: no se escribe nada (usa --apply para confirmar).\n");

  const removedClients = await db
    .select({ id: clients.id, name: clients.legalName })
    .from(clients)
    .where(isNotNull(clients.deletedAt));

  for (const client of removedClients) {
    const r = await run((tx, now) => removeClient(tx, client.id, now));
    const verb = r.mode === "deleted" ? "se borra" : "sigue deshabilitado";
    console.log(
      `Cliente ${client.name}: ${verb}. Sedes borradas ${r.deletedCostCenters}, deshabilitadas ${r.disabledCostCenters}; ` +
        `equipos ${r.equipment}, contratos ${r.activeContracts}, OTs pendientes ${r.pendingWorkOrders}, ` +
        `cotizaciones ${r.openQuotations}, portales ${r.portalsRemoved}.`
    );
  }

  // Sedes dadas de baja cuyo cliente sigue activo.
  const removedCenters = await db
    .select({ id: costCenters.id, name: costCenters.name, client: clients.legalName })
    .from(costCenters)
    .innerJoin(clients, eq(clients.id, costCenters.clientId))
    .where(and(isNotNull(costCenters.deletedAt), isNull(clients.deletedAt)));

  for (const center of removedCenters) {
    const r = await run((tx, now) => removeCostCenter(tx, center.id, now));
    const verb = r.mode === "deleted" ? "se borra" : "sigue deshabilitada";
    console.log(
      `Sede ${center.name} (${center.client}): ${verb}. Equipos ${r.equipment}, contratos ${r.activeContracts}, ` +
        `OTs pendientes ${r.pendingWorkOrders}, cotizaciones ${r.openQuotations}, portal ${r.hasPortal ? "sí" : "no"}.`
    );
  }

  console.log(`\n${removedClients.length} clientes y ${removedCenters.length} sedes revisados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
