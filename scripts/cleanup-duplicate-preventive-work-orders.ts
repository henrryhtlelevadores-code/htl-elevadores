/**
 * Consolida OTs PREV duplicadas (misma sede, fecha y hora) pagando de la
 * generación anterior a `generateMonth`, que creaba 1 OT por parada.
 *
 * Para cada grupo duplicado:
 *   - elige la OT canónica (más equipos; desempate por fecha de creación),
 *   - mueve los work_order_elevators de las duplicadas a la canónica,
 *   - elimina las OTs duplicadas (ON DELETE SET NULL libera los stops).
 *
 * No toca OTs con ejecución registrada (inician/completan) ni soft-deleted.
 *
 *   npx tsx --env-file=.env.local scripts/cleanup-duplicate-preventive-work-orders.ts
 *   npx tsx --env-file=.env.local scripts/cleanup-duplicate-preventive-work-orders.ts --apply
 */
import "dotenv/config";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });

type WoRow = {
  id: string;
  ot_number: string;
  cost_center_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  started_at: number | null;
  completed_at: number | null;
  created_at: number | null;
  elevators: number;
};

type Group = {
  cost_center_id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  wos: WoRow[];
};

async function main() {
  const apply = process.argv.includes("--apply");

  const { rows } = await client.execute(
    `SELECT wo.id, wo.ot_number, wo.cost_center_id, wo.scheduled_date, wo.scheduled_time,
            wo.status, wo.started_at, wo.completed_at, wo.created_at,
            (SELECT COUNT(*) FROM work_order_elevators woe WHERE woe.work_order_id = wo.id) AS elevators
     FROM work_orders wo
     JOIN service_types st ON st.id = COALESCE(wo.service_type_id, wo.type)
     WHERE st.code = 'PREV'
       AND wo.deleted_at IS NULL
       AND wo.scheduled_date IS NOT NULL
       AND wo.scheduled_time IS NOT NULL
     ORDER BY wo.cost_center_id, wo.scheduled_date, wo.scheduled_time, wo.created_at, wo.ot_number`
  );

  const groups = new Map<string, Group>();
  for (const w of rows as unknown as WoRow[]) {
    const key = `${w.cost_center_id}|${w.scheduled_date}|${w.scheduled_time}`;
    const g = groups.get(key) ?? {
      cost_center_id: w.cost_center_id,
      scheduled_date: w.scheduled_date,
      scheduled_time: w.scheduled_time,
      wos: [],
    };
    g.wos.push(w);
    groups.set(key, g);
  }

  const duplicated = [...groups.values()].filter((g) => g.wos.length > 1);
  if (duplicated.length === 0) {
    console.log("No hay OTs PREV duplicadas.");
    return;
  }

  let moved = 0;
  let deleted = 0;

  for (const g of duplicated) {
    const executed = g.wos.filter((w) => w.status !== "PENDING" || w.started_at || w.completed_at);
    if (executed.length > 0) {
      console.log(
        `OMITIDO ${g.scheduled_date} ${g.scheduled_time} · ${g.cost_center_id.slice(0, 8)}: ` +
          `${executed.map((w) => w.ot_number).join(", ")} tienen ejecución registrada`
      );
      continue;
    }

    // Canónica: la que más equipos tiene; desempate por la más antigua.
    const sorted = [...g.wos].sort(
      (a, b) => b.elevators - a.elevators || (a.created_at ?? 0) - (b.created_at ?? 0)
    );
    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    console.log(
      `${g.scheduled_date} ${g.scheduled_time} · sede ${g.cost_center_id.slice(0, 8)} → ` +
        `canónica ${canonical.ot_number} (${canonical.elevators} equipos); ` +
        `duplicadas: ${duplicates.map((w) => `${w.ot_number}(${w.elevators})`).join(", ")}`
    );

    for (const dup of duplicates) {
      if (apply) {
        await client.batch(
          [
            {
              sql: "UPDATE work_order_elevators SET work_order_id = ? WHERE work_order_id = ?",
              args: [canonical.id, dup.id],
            },
            { sql: "DELETE FROM work_orders WHERE id = ?", args: [dup.id] },
          ],
          "write"
        );
      }
      moved += Number(dup.elevators);
      deleted++;
    }
  }

  console.log(
    apply
      ? `\nConsolidado: ${deleted} OT(s) eliminada(s), ${moved} equipo(s) movidos.`
      : "\nDry-run: no se aplicó nada."
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
