import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect:
    url.startsWith("libsql:") || url.startsWith("https:")
      ? "turso"
      : "sqlite",
  dbCredentials: {
    url,
    ...(authToken ? { authToken } : {}),
  },
});
