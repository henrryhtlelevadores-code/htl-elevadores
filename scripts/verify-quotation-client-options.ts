import "dotenv/config";
import { createRequire } from "node:module";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index";

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

let failures = 0;
function check(label: string, ok: boolean, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const { getQuotationFormData, createQuotation } = (await import(
    "../src/features/quotations/actions"
  )) as typeof import("../src/features/quotations/actions");

  const options = await getQuotationFormData();

  const names = options.clients.map((c) => (c.legalName ?? "").toUpperCase());
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  check("sin clientes duplicados", dupes.length === 0, dupes.join(", "));
  check(
    "EDIFICIO MENDIBURO aparece una vez",
    names.filter((n) => n === "EDIFICIO MENDIBURO").length === 1
  );

  const mendiburo = options.clients.find((c) => c.legalName?.toUpperCase() === "EDIFICIO MENDIBURO");
  check("cliente Mendiburo disponible", !!mendiburo, mendiburo?.id);

  const sedes = options.costCenters.filter((cc) => cc.clientId === mendiburo?.id);
  check("su sede tiene centro de costo", sedes.length > 0, sedes.map((s) => `${s.name} (${s.id.slice(0, 8)})`).join(", "));

  const equipment = options.equipment.filter((e) => sedes.some((s) => s.id === e.costCenterId));
  check("tiene equipos para cotizar", equipment.length > 0, `${equipment.length} equipos`);

  // Creación real con el cliente que fallaba
  const before = await db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM quotations`);
  const res = await createQuotation({
    clientId: mendiburo!.id,
    costCenterId: sedes[0]?.id ?? "",
    advisorId: "",
    issueDate: "2026-01-15",
    validUntil: "2026-02-15",
    status: "",
    discountMode: "PERCENT",
    discountRate: "0",
    discountAmount: "",
    targetTotal: "",
    targetTotalIncludesIgv: true,
    notes: "",
    terms: "",
    lines: [
      {
        elevatorUnityId: equipment[0]?.id ?? "",
        description: "Prueba automática de cotización",
        totalHours: "2",
        hourlyCost: "50",
        lineMode: "CALCULATED",
        lineModeReason: "",
        manualPrice: "",
        manualPriceIncludesIgv: true,
        supplierName: "",
        supplierCost: "",
        overridePrice: false,
        lineOverridePrice: "",
        lineOverrideReason: "",
        products: [],
      },
    ],
  } as never);
  check("createQuotation responde éxito", res.success === true, res.error ?? res.message);

  if (res.success) {
    const after = await db.get<{ n: number }>(sql`SELECT COUNT(*) AS n FROM quotations`);
    check("la cotización se guardó", Number(after.n) === Number(before.n) + 1, `${before.n} -> ${after.n}`);
    const created = await db.get<{ id: string; quotation_number: string }>(
      sql`SELECT id, quotation_number FROM quotations WHERE notes IS NULL ORDER BY created_at DESC LIMIT 1`
    );
    await db.run(sql`DELETE FROM quotation_lines WHERE quotation_id = ${created.id}`);
    await db.run(sql`DELETE FROM quotations WHERE id = ${created.id}`);
    console.log(`rollback: ${created.quotation_number} eliminada`);
  }

  console.log(failures === 0 ? "\nOK" : `\n${failures} fallo(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
