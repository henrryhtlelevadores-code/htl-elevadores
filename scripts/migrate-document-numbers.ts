import { readFileSync, existsSync } from "node:fs";
import { createClient, type Client } from "@libsql/client";
import {
  generateDocumentNumber,
  monthPeriodFromUnix,
  yearFromUnix,
} from "../src/lib/document-number";

function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^["']|["']$/g, "");
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

loadEnvLocal();

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const apply = process.argv.includes("--apply");
const client: Client = createClient({ url, ...(authToken ? { authToken } : {}) });

type Update = { table: string; id: string; from: string; to: string };

function periodFromNumber(prefix: string, value: string, groups: number): string | null {
  const match = new RegExp(`^${prefix}-((?:\\d+-){${groups - 1}}\\d+)`).exec(value);
  return match ? match[1] : null;
}

function monthPeriodFromIso(iso: string | null): string | null {
  const match = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  return match ? `${match[1]}-${match[2]}` : null;
}

async function planWorkOrders(): Promise<Update[]> {
  const rows = await client.execute(
    "SELECT id, ot_number, scheduled_date, created_at FROM work_orders"
  );
  const used = new Set(rows.rows.map((r) => String(r.ot_number)));
  const updates: Update[] = [];
  for (const row of rows.rows) {
    const from = String(row.ot_number);
    const period =
      periodFromNumber("OT", from, 2) ??
      monthPeriodFromIso((row.scheduled_date as string) ?? null) ??
      monthPeriodFromUnix(Number(row.created_at) || null);
    const to = generateDocumentNumber("OT", period);
    if (to === from) continue;
    updates.push({ table: "work_orders", id: String(row.id), from, to });
    used.add(to);
  }
  return updates;
}

async function planQuotations(): Promise<Update[]> {
  const rows = await client.execute("SELECT id, quotation_number, issue_date FROM quotations");
  const used = new Set(rows.rows.map((r) => String(r.quotation_number)));
  const updates: Update[] = [];
  for (const row of rows.rows) {
    const from = String(row.quotation_number);
    const period =
      periodFromNumber("QT", from, 1) ?? yearFromUnix(Number(row.issue_date) || null);
    const to = generateDocumentNumber("QT", period);
    if (to === from) continue;
    updates.push({ table: "quotations", id: String(row.id), from, to });
    used.add(to);
  }
  return updates;
}

async function planContracts(): Promise<Update[]> {
  const rows = await client.execute("SELECT id, contract_number, start_date FROM contracts");
  const used = new Set(rows.rows.map((r) => String(r.contract_number)));
  const updates: Update[] = [];
  for (const row of rows.rows) {
    const from = String(row.contract_number);
    const period =
      periodFromNumber("CT", from, 1) ?? yearFromUnix(Number(row.start_date) || null);
    const to = generateDocumentNumber("CT", period);
    if (to === from) continue;
    updates.push({ table: "contracts", id: String(row.id), from, to });
    used.add(to);
  }
  return updates;
}

async function main() {
  const updates = [
    ...(await planWorkOrders()),
    ...(await planQuotations()),
    ...(await planContracts()),
  ];

  console.log(`${apply ? "APLICAR" : "DRY-RUN"}: ${updates.length} documento(s) a renumerar`);
  for (const u of updates) {
    console.log(`  ${u.table.padEnd(12)} ${u.from}  ->  ${u.to}`);
  }

  if (!apply) {
    console.log("\n(dry-run) ejecuta con --apply para aplicar los cambios");
    return;
  }

  if (updates.length > 0) {
    await client.batch(
      updates.map((u) => ({
        sql: `UPDATE ${u.table} SET ${
          u.table === "work_orders"
            ? "ot_number"
            : u.table === "quotations"
              ? "quotation_number"
              : "contract_number"
        } = ? WHERE id = ?`,
        args: [u.to, u.id],
      })),
      "write"
    );
  }
  console.log(`\nOK: ${updates.length} documento(s) renumerado(s)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
