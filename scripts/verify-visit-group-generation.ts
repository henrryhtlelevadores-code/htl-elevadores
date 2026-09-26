/**
 * Verificación de la generación agrupada por visita.
 * Usa un mes de prueba y hace rollback al terminar.
 *
 *   npx tsx --env-file=.env.local scripts/verify-visit-group-generation.ts
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index";

// `server-only` / `next/cache` no existen fuera de Next: se neutralizan para poder
// ejecutar las server actions desde este script de verificación.
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
const Module = require2("module") as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: unknown[]) {
  if (request === "server-only") return require2.resolve("./stubs/server-only.cjs");
  if (request === "next/cache") return require2.resolve("./stubs/next-cache.cjs");
  return origResolve.call(this, request, ...rest);
};

async function loadActions() {
  return (await import("../src/features/routes/actions")) as typeof import("../src/features/routes/actions");
}

const TEST_MONTH = "2099-01";
const TEST_TIME = "07:31";

type StopRow = {
  id: string;
  visit_group_id: string | null;
  generated_work_order_id: string | null;
  generated_month: string | null;
};

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

async function rollback() {
  const ots = await db.all<{ id: string }>(
    sql`SELECT id FROM work_orders WHERE ot_number LIKE ${`OT-${TEST_MONTH}-%`}`
  );
  for (const ot of ots) {
    await db.run(sql`DELETE FROM work_order_elevators WHERE work_order_id = ${ot.id}`);
    await db.run(sql`DELETE FROM work_orders WHERE id = ${ot.id}`);
  }
  await db.run(
    sql`UPDATE preventive_route_stops
         SET generated_work_order_id = NULL, generated_month = NULL, generated_at = NULL
         WHERE generated_month = ${TEST_MONTH}`
  );
  console.log(`\nrollback: ${ots.length} OT(s) de prueba eliminadas`);
}

async function main() {
  const { generateMonth, createRouteStops } = await loadActions();
  const technicians = await db.all<{ technician_id: string }>(
    sql`SELECT DISTINCT pr.technician_id
        FROM preventive_route_stops s
        JOIN preventive_routes pr ON pr.id = s.route_id`
  );
  const technicianId = technicians[0]?.technician_id;
  if (!technicianId) throw new Error("No hay técnicos con rutas");

  // 0) Creación: 1 payload = 1 visita con N equipos
  const candidate = await db.all<{ contract_id: string; n: number }>(
    sql`SELECT ce.contract_id, COUNT(*) AS n
        FROM contract_elevators ce
        JOIN contracts c ON c.id = ce.contract_id
        JOIN elevator_unity eu ON eu.id = ce.elevator_unity_id
        WHERE c.deleted_at IS NULL AND c.status = 'ACTIVE' AND eu.deleted_at IS NULL
        GROUP BY ce.contract_id
        ORDER BY n DESC
        LIMIT 1`
  );
  const contractId = candidate[0]?.contract_id;
  if (contractId) {
    const equipment = await db.all<{ elevator_unity_id: string }>(
      sql`SELECT ce.elevator_unity_id FROM contract_elevators ce
          JOIN elevator_unity eu ON eu.id = ce.elevator_unity_id
          WHERE ce.contract_id = ${contractId} AND eu.deleted_at IS NULL
          LIMIT 3`
    );
    const unityIds = equipment.map((e) => e.elevator_unity_id);
    const created = await createRouteStops({
      technicianId,
      businessDayNumber: 1,
      plannedTime: TEST_TIME,
      estimatedDurationMins: 90,
      contractId,
      elevatorUnityIds: unityIds,
    });
    check("crea visita agrupada", created.success === true, JSON.stringify(created));

    const stops = await db.all<StopRow>(
      sql`SELECT s.id, s.visit_group_id, s.generated_work_order_id, s.generated_month
          FROM preventive_route_stops s
          JOIN preventive_routes pr ON pr.id = s.route_id
          WHERE pr.technician_id = ${technicianId} AND s.planned_time = ${TEST_TIME}`
    );
    check(
      "los equipos comparten visit_group_id",
      stops.length === unityIds.length && new Set(stops.map((s) => s.visit_group_id)).size === 1,
      JSON.stringify(stops)
    );
    const createdStops = await db.all<{ elevator_unity_id: string; contract_id: string }>(
      sql`SELECT ce.elevator_unity_id, ce.contract_id
          FROM preventive_route_stops s
          JOIN contract_elevators ce ON ce.id = s.contract_elevator_id
          WHERE s.planned_time = ${TEST_TIME}`
    );
    check(
      "solo crea stops del contrato y equipos seleccionados",
      createdStops.length === unityIds.length &&
        createdStops.every(
          (s) => s.contract_id === contractId && unityIds.includes(s.elevator_unity_id)
        ),
      JSON.stringify(createdStops)
    );

    await db.run(sql`DELETE FROM preventive_route_stops WHERE planned_time = ${TEST_TIME}`);
    console.log(`rollback creación: ${stops.length} stops de prueba eliminados\n`);
  }

  const groups = await db.all<{ visit_group_id: string; n: number }>(
    sql`SELECT visit_group_id, COUNT(*) AS n
        FROM preventive_route_stops s
        JOIN preventive_routes pr ON pr.id = s.route_id
        WHERE pr.technician_id = ${technicianId}
        GROUP BY visit_group_id`
  );
  const totalStops = groups.reduce((a, g) => a + Number(g.n), 0);
  console.log(`técnico ${technicianId}: ${groups.length} visitas / ${totalStops} equipos\n`);

  // 1) Primera generación: 1 OT por visita
  const first = await generateMonth(technicianId, TEST_MONTH);
  check("genera 1 OT por visita", first.created === groups.length, `created=${first.created}, visitas=${groups.length}`);
  check("sin errores", (first.errors?.length ?? 0) === 0, JSON.stringify(first.errors));

  const ots = await db.all<{ id: string; ot_number: string; n: number }>(
    sql`SELECT wo.id, wo.ot_number, COUNT(woe.id) AS n
        FROM work_orders wo
        JOIN work_order_elevators woe ON woe.work_order_id = wo.id
        WHERE wo.ot_number LIKE ${`OT-${TEST_MONTH}-%`}
        GROUP BY wo.id`
  );
  check("cada OT tiene sus N equipos", ots.length === groups.length, `ots=${ots.length}`);
  const badCount = ots.filter((o) => {
    const g = groups.find((x) => Number(x.n) === Number(o.n));
    return !g;
  });
  check("conteos de equipos coinciden con visitas", badCount.length === 0, badCount.map((o) => `${o.ot_number}=${o.n}`).join(", "));

  const links = await db.all<{ visit_group_id: string; ots: number; n: number }>(
    sql`SELECT visit_group_id, COUNT(DISTINCT generated_work_order_id) AS ots, COUNT(*) AS n
        FROM preventive_route_stops s
        JOIN preventive_routes pr ON pr.id = s.route_id
        WHERE pr.technician_id = ${technicianId} AND s.generated_month = ${TEST_MONTH}
        GROUP BY visit_group_id`
  );
  check("todos los equipos de una visita apuntan a la misma OT", links.every((l) => Number(l.ots) === 1), JSON.stringify(links));

  // 2) Re-generación: idempotente
  const second = await generateMonth(technicianId, TEST_MONTH);
  check("re-generar omite todo", second.created === 0 && second.skipped === totalStops, `created=${second.created}, skipped=${second.skipped}`);

  // 3) Visita parcial: debe regenerar el grupo completo
  const target = links[0];
  const before = await db.all<{ id: string }>(
    sql`SELECT id FROM work_orders WHERE ot_number LIKE ${`OT-${TEST_MONTH}-%`}`
  );
  const orphan = target
    ? (
        await db.all<StopRow>(
          sql`SELECT id, visit_group_id, generated_work_order_id, generated_month
              FROM preventive_route_stops
              WHERE visit_group_id = ${target.visit_group_id} LIMIT 1 OFFSET 1`
        )
      )[0]
    : undefined;
  if (orphan) {
    await db.run(
      sql`UPDATE preventive_route_stops
          SET generated_work_order_id = NULL
          WHERE id = ${orphan.id}`
    );
    const third = await generateMonth(technicianId, TEST_MONTH);
    check("visita parcial se regenera completa", third.created === 1, `created=${third.created}`);

    const stillThere = await db.all<{ id: string }>(
      sql`SELECT id FROM work_orders WHERE ot_number LIKE ${`OT-${TEST_MONTH}-%`}`
    );
    check("no deja OTs huérfanas", stillThere.length === before.length, `${before.length} -> ${stillThere.length}`);

    const healed = await db.all<{ ots: number; n: number }>(
      sql`SELECT COUNT(DISTINCT generated_work_order_id) AS ots, COUNT(*) AS n
          FROM preventive_route_stops WHERE visit_group_id = ${target.visit_group_id}`
    );
    check("grupo parcial queda con 1 OT", Number(healed[0]?.ots) === 1 && Number(healed[0]?.n) === Number(target.n), JSON.stringify(healed));
  } else {
    check("caso parcial disponible", false, "ningún grupo con >1 equipo");
  }

  await rollback();
  console.log(failures === 0 ? "\nOK: todas las verificaciones pasaron" : `\n${failures} verificación(es) fallaron`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await rollback();
  process.exit(1);
});
