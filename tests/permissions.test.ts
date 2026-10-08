import { describe, expect, it } from "vitest";
import { hasAnyPermission, hasPermission } from "@/features/auth/permissions";

describe("coincidencia de permisos", () => {
  it("es exacta por segmentos, no por subcadena", () => {
    expect(hasPermission(["users:read"], "users:read")).toBe(true);
    expect(hasPermission(["users:read"], "users:readonly")).toBe(false);
    expect(hasPermission(["users:readonly"], "users:read")).toBe(false);
    expect(hasPermission(["user"], "users:read")).toBe(false);
    expect(hasPermission(["users"], "user:read")).toBe(false);
  });

  it("lectura no concede escritura ni al revés", () => {
    expect(hasPermission(["users:read"], "users:write")).toBe(false);
    expect(hasPermission(["users:write"], "users:read")).toBe(false);
  });

  it("un permiso más general cubre a los más específicos, no al contrario", () => {
    expect(hasPermission(["work_orders"], "work_orders:panel:write")).toBe(true);
    expect(hasPermission(["work_orders:panel"], "work_orders:panel:read")).toBe(true);
    expect(hasPermission(["work_orders:panel:read"], "work_orders:panel")).toBe(false);
    expect(hasPermission(["work_orders:panel:read"], "work_orders:panel:write")).toBe(false);
  });

  it("el técnico de campo no hereda las acciones del panel", () => {
    const technician = ["work_orders:field", "safety"];
    expect(hasPermission(technician, "work_orders:panel:write")).toBe(false);
    expect(hasPermission(technician, "work_orders:panel:read")).toBe(false);
    expect(hasPermission(technician, "work_orders:field:write")).toBe(true);
  });

  it("* lo cubre todo y una lista vacía no cubre nada", () => {
    expect(hasPermission(["*"], "users:write")).toBe(true);
    expect(hasPermission(["*"], "reports:approve")).toBe(true);
    expect(hasPermission([], "users:read")).toBe(false);
  });

  it("un permiso mal formado no concede nada", () => {
    expect(hasPermission(["users:*"], "users:read")).toBe(false);
    expect(hasPermission(["Users:Read"], "users:read")).toBe(false);
    expect(hasPermission([""], "users:read")).toBe(false);
    expect(hasPermission(["users:read"], "")).toBe(false);
  });

  it("hasAnyPermission basta con uno", () => {
    expect(hasAnyPermission(["contracts:read"], ["clients:read", "contracts:read"])).toBe(true);
    expect(hasAnyPermission(["invoices:read"], ["clients:read", "contracts:read"])).toBe(false);
  });
});
