/**
 * Asigna `visit_group_id` a las paradas de ruta agrupando por visita real:
 * (route_id, planned_time, contract_id).
 *
 * Una visita = un grupo. Al generar el mes, cada grupo produce 1 OT con
 * N work_order_elevators.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/backfill-visit-groups.ts          # dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-visit-groups.ts --apply
 *   npx tsx --env-file=.env.local scripts/backfill-visit-groups.ts --apply --only-unset
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });

type Row = {
  id: string;
  route_id: string;
  planned_time: string;
  contract_id: string;
  visit_group_id: string | null;
  generated_month: string | null;
  generated_work_order_id: string | null;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const onlyUnset = process.argv.includes("--only-unset");

  const { rows } = await client.execute(
    `SELECT s.id, s.route_id, s.planned_time, ce.contract_id, s.visit_group_id,
            s.generated_month, s.generated_work_order_id
     FROM preventive_route_stops s
     JOIN contract_elevators ce ON ce.id = s.contract_elevator_id
     ORDER BY s.route_id, s.planned_time, s.order_index`
  );
  const stops = rows as unknown as Row[];
  if (stops.length === 0) {
    console.log("No hay paradas que actualizar.");
    return;
  }

  const linked = stops.filter((s) => s.generated_month !== null);
  if (linked.length > 0) {
    console.log(
      `⚠ ${linked.length} parada(s) ya generadas. Reasignar sus grupos puede dejar OTs huérfanas; regenera el mes después.`
    );
  }

  // Un grupo por (route_id, planned_time, contract_id)
  const groups = new Map<string, Row[]>();
  for (const stop of stops) {
    if (onlyUnset && stop.visit_group_id !== null) continue;
    const key = `${stop.route_id}|${stop.planned_time}|${stop.contract_id}`;
    const list = groups.get(key) ?? [];
    list.push(stop);
    groups.set(key, list);
  }

  let updated = 0;
  for (const [key, members] of groups) {
    const groupId = randomUUID();
    const [routeId, plannedTime, contractId] = key.split("|");
    console.log(
      `grupo ${groupId} → ${plannedTime} · contrato ${contractId.slice(0, 8)} · ` +
        `${members.length} equipo(s): ${members.map((m) => m.id.slice(0, 8)).join(", ")}` +
        ` [route ${routeId.slice(0, 8)}]`
    );
    if (!apply) continue;
    for (const member of members) {
      await client.execute({
        sql: "UPDATE preventive_route_stops SET visit_group_id = ? WHERE id = ?",
        args: [groupId, member.id],
      });
      updated++;
    }
  }

  const verify = await client.execute(
    `SELECT COUNT(*) AS total,
            COUNT(DISTINCT visit_group_id) AS groups,
            SUM(CASE WHEN visit_group_id IS NULL THEN 1 ELSE 0 END) AS sin_grupo
     FROM preventive_route_stops`
  );
  console.log("verificación:", JSON.stringify(verify.rows[0]));
  console.log(apply ? `Actualizadas ${updated} paradas.` : "Dry-run: no se aplicó nada.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
