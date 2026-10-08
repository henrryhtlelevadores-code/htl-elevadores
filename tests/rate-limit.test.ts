import { beforeEach, describe, expect, it, vi } from "vitest";

// Envoltorio espía sobre Argon2 para comprobar que un intento bloqueado no
// llega a verificar la contraseña.
const argon = vi.hoisted(() => ({ verifyCalls: 0 }));
vi.mock("@node-rs/argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@node-rs/argon2")>();
  return {
    ...actual,
    verify: (...args: Parameters<typeof actual.verify>) => {
      argon.verifyCalls += 1;
      return actual.verify(...args);
    },
  };
});

import { loginAction } from "@/features/auth/actions";
import { portalLoginAction } from "@/features/portal/actions";
import { getSessionUser } from "@/features/auth/server";
import { setRateLimitStore } from "@/lib/rate-limit";
import { MemoryRateLimitStore } from "@/lib/rate-limit/store";
import {
  BASE_LOCK_SECONDS,
  MAX_FAILURES,
  MAX_LOCK_SECONDS,
  WINDOW_SECONDS,
  evaluateFailures,
} from "@/lib/rate-limit/policy";
import { resetRequest } from "./helpers/request";
import { STAFF_PASSWORD, createCostCenter, createUser } from "./helpers/fixtures";

describe("política de bloqueo", () => {
  const t0 = 1_800_000_000;
  const burst = (start: number, count = MAX_FAILURES) =>
    Array.from({ length: count }, (_, i) => start + i);

  it("permite menos de 5 fallos", () => {
    expect(evaluateFailures(burst(t0, 4), t0 + 10).allowed).toBe(true);
  });

  it("bloquea 15 minutos tras 5 fallos en la ventana", () => {
    const decision = evaluateFailures(burst(t0), t0 + 5);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(BASE_LOCK_SECONDS - 1);
    expect(evaluateFailures(burst(t0), t0 + 4 + BASE_LOCK_SECONDS).allowed).toBe(true);
  });

  it("5 fallos repartidos fuera de la ventana no bloquean", () => {
    const spaced = Array.from({ length: 5 }, (_, i) => t0 + i * WINDOW_SECONDS);
    expect(evaluateFailures(spaced, spaced[4] + 1).allowed).toBe(true);
  });

  it("cada bloqueo sucesivo dura el doble (backoff exponencial)", () => {
    const second = t0 + BASE_LOCK_SECONDS + 10;
    const failures = [...burst(t0), ...burst(second)];
    const decision = evaluateFailures(failures, second + 5);
    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(2 * BASE_LOCK_SECONDS - 1);
  });

  it("el bloqueo tiene un tope de 24 horas", () => {
    let start = t0;
    let failures: number[] = [];
    for (let i = 0; i < 12; i++) {
      failures = [...failures, ...burst(start)];
      start += MAX_LOCK_SECONDS + 100;
    }
    const last = failures[failures.length - 1];
    expect(evaluateFailures(failures, last).retryAfterSeconds).toBe(MAX_LOCK_SECONDS);
  });
});

describe("rate limit en el login de personal", () => {
  beforeEach(() => {
    resetRequest();
    setRateLimitStore(new MemoryRateLimitStore());
    argon.verifyCalls = 0;
  });

  it("bloquea tras 5 intentos fallidos y deja de ejecutar Argon2", async () => {
    const user = await createUser({ permissions: ["*"] });

    for (let i = 0; i < MAX_FAILURES; i++) {
      const res = await loginAction({ email: user.email, password: "clave-incorrecta" });
      expect(res).toMatchObject({ success: false });
      expect((res as { error: string }).error).toMatch(/Credenciales inválidas/);
    }
    expect(argon.verifyCalls).toBe(MAX_FAILURES);

    // Sexto intento, ahora con la contraseña correcta: sigue bloqueado.
    const blocked = await loginAction({ email: user.email, password: STAFF_PASSWORD });
    expect(blocked.success).toBe(false);
    expect((blocked as { error: string }).error).toMatch(/Demasiados intentos/);
    expect(argon.verifyCalls).toBe(MAX_FAILURES);
    expect(await getSessionUser()).toBeNull();
  });

  it("los intentos correctos no cuentan y borran los fallos previos", async () => {
    const user = await createUser({ permissions: ["*"] });

    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < MAX_FAILURES - 1; i++) {
        await loginAction({ email: user.email, password: "clave-incorrecta" });
      }
      const ok = await loginAction({ email: user.email, password: STAFF_PASSWORD });
      expect(ok.success).toBe(true);
    }
    // 12 fallos en total, pero nunca 5 seguidos sin un acierto entre medias.
    for (let i = 0; i < 10; i++) {
      expect((await loginAction({ email: user.email, password: STAFF_PASSWORD })).success).toBe(true);
    }
  });

  it("el bloqueo es por correo: no afecta a otra cuenta", async () => {
    const victim = await createUser({ permissions: ["*"] });
    const other = await createUser({ permissions: ["*"] });
    for (let i = 0; i < MAX_FAILURES; i++) {
      await loginAction({ email: victim.email, password: "clave-incorrecta" });
    }
    expect((await loginAction({ email: other.email, password: STAFF_PASSWORD })).success).toBe(true);
  });

  it("también cuenta los intentos contra correos que no existen", async () => {
    const email = "nadie@example.test";
    for (let i = 0; i < MAX_FAILURES; i++) {
      await loginAction({ email, password: "clave-incorrecta" });
    }
    const blocked = await loginAction({ email, password: "clave-incorrecta" });
    expect((blocked as { error: string }).error).toMatch(/Demasiados intentos/);
  });
});

describe("rate limit en el login del portal", () => {
  beforeEach(() => {
    resetRequest();
    setRateLimitStore(new MemoryRateLimitStore());
    argon.verifyCalls = 0;
  });

  it("bloquea tras 5 intentos fallidos y deja de ejecutar Argon2", async () => {
    const costCenter = await createCostCenter({ password: "Portal-4821" });
    for (let i = 0; i < MAX_FAILURES; i++) {
      const res = await portalLoginAction({ costCenterId: costCenter.id, password: "incorrecta" });
      expect(res.success).toBe(false);
    }
    expect(argon.verifyCalls).toBe(MAX_FAILURES);

    const blocked = await portalLoginAction({ costCenterId: costCenter.id, password: "Portal-4821" });
    expect(blocked.success).toBe(false);
    expect((blocked as { error: string }).error).toMatch(/Demasiados intentos/);
    expect(argon.verifyCalls).toBe(MAX_FAILURES);
  });
});
