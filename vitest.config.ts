import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
// Base SQLite temporal y desechable: los tests nunca tocan Turso.
const testDb = join(tmpdir(), `htl-vitest-${process.pid}.db`);

const testEnv = {
  TURSO_DATABASE_URL: `file:${testDb.replace(/\\/g, "/")}`,
  TURSO_AUTH_TOKEN: "",
  RATE_LIMIT_STORE: "memory",
  HTL_TEST_DB: testDb,
};
// `test.env` solo llega a los workers; el globalSetup corre en este proceso.
Object.assign(process.env, testEnv);

export default defineConfig({
  resolve: {
    alias: {
      "@": join(root, "src"),
      // "server-only" lanza fuera de un bundle de servidor de Next.
      "server-only": join(root, "scripts/stubs/server-only.cjs"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Una sola base compartida: los archivos se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 30_000,
    env: testEnv,
  },
});
