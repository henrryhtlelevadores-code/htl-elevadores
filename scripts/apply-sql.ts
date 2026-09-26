import "dotenv/config";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, ...(authToken ? { authToken } : {}) });

const file = process.argv[2];
const content = readFileSync(file, "utf-8");
const statements = content
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  for (const stmt of statements) {
    try {
      await client.execute(stmt);
      console.log("OK  ", stmt.split("\n")[0].slice(0, 90));
    } catch (e) {
      console.error("FAIL", stmt.split("\n")[0].slice(0, 90));
      console.error("     ", String((e as Error).message).slice(0, 200));
      process.exit(1);
    }
  }
  console.log("done");
}

main().then(() => process.exit(0));
