import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSessionToken,
  sessionCookieName,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/session-token";
import { createSession } from "@/features/auth/server";
import { createPortalSession } from "@/features/portal/server";
import { SESSION_COOKIE } from "@/features/auth/session";
import { PORTAL_SESSION_COOKIE } from "@/features/portal/session";
import { cookieJar, resetRequest } from "./helpers/request";

describe("tokens de sesión", () => {
  beforeEach(() => resetRequest());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("un token del portal no sirve como sesión de personal", () => {
    const portalToken = createSessionToken("portal", "CENTRO-1", 0, 3600);
    expect(verifySessionToken("portal", portalToken)?.subject).toBe("CENTRO-1");
    expect(verifySessionToken("staff", portalToken)).toBeNull();
  });

  it("un token de personal no sirve como sesión del portal", () => {
    const staffToken = createSessionToken("staff", "USER-1", 0, 3600);
    expect(verifySessionToken("portal", staffToken)).toBeNull();
  });

  it("no basta con cambiar el tipo en el token: la firma deja de coincidir", () => {
    const portalToken = createSessionToken("portal", "CENTRO-1", 0, 3600);
    const forged = portalToken.replace("v2.portal.", "v2.staff.");
    expect(verifySessionToken("staff", forged)).toBeNull();
  });

  it("rechaza el formato antiguo de tres partes", () => {
    expect(verifySessionToken("staff", "USER-1.9999999999.abcdef")).toBeNull();
  });

  it("rechaza un token expirado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSessionToken("staff", "USER-1", 0, 60);
    expect(verifySessionToken("staff", token)).not.toBeNull();
    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    expect(verifySessionToken("staff", token)).toBeNull();
  });

  it("rechaza un token con la versión manipulada", () => {
    const token = createSessionToken("staff", "USER-1", 3, 3600);
    expect(verifySessionToken("staff", token.replace(".3.", ".4."))).toBeNull();
  });

  it("en producción exige secretos definidos y distintos", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STAFF_SESSION_SECRET", "");
    vi.stubEnv("PORTAL_SESSION_SECRET", "");
    expect(() => createSessionToken("staff", "USER-1", 0, 60)).toThrow(/STAFF_SESSION_SECRET/);

    vi.stubEnv("STAFF_SESSION_SECRET", "mismo-secreto");
    vi.stubEnv("PORTAL_SESSION_SECRET", "mismo-secreto");
    expect(() => createSessionToken("staff", "USER-1", 0, 60)).toThrow(/distintos/);
  });
});

describe("cookies de sesión", () => {
  beforeEach(() => resetRequest());
  afterEach(() => vi.unstubAllEnvs());

  it("personal y portal usan cookies distintas, HttpOnly y SameSite=Lax", async () => {
    await createSession("USER-1", 0);
    await createPortalSession("CENTRO-1", 0);

    expect(SESSION_COOKIE).not.toBe(PORTAL_SESSION_COOKIE);
    for (const name of [SESSION_COOKIE, PORTAL_SESSION_COOKIE]) {
      const cookie = cookieJar.raw(name);
      expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
      expect(cookie?.options).not.toHaveProperty("domain");
      expect(Number(cookie?.options.maxAge)).toBeGreaterThan(0);
    }
  });

  it("en producción llevan Secure y el prefijo __Host-", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(sessionCookieName("staff")).toBe("__Host-htl_staff_session");
    expect(sessionCookieName("portal")).toBe("__Host-htl_portal_session");
    expect(sessionCookieOptions(60)).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });
});
