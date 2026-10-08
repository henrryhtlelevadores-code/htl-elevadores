import { existsSync, rmSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { pushSQLiteSchema } from "drizzle-kit/api";
import * as schema from "../src/db/schema";

/**
 * Crea la base SQLite temporal de los tests a partir de `src/db/schema.ts`.
 * La ruta la fija vitest.config.ts; nunca apunta a Turso.
 */
export default async function setup() {
  const file = process.env.HTL_TEST_DB;
  const url = process.env.TURSO_DATABASE_URL;
  if (!file || !url?.startsWith("file:")) {
    throw new Error("Los tests solo pueden ejecutarse contra una base local temporal.");
  }
  if (existsSync(file)) rmSync(file);

  const client = createClient({ url });
  const { apply } = await pushSQLiteSchema(schema, drizzle(client));
  await apply();
  client.close();

  return () => {
    if (existsSync(file)) rmSync(file, { force: true });
  };
}
