import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearchText } from "@/lib/search";

const row = normalizeSearchText("Corporación Real S.A. 20601234567 facturas@real.pe");

describe("buscador de las tablas", () => {
  it("ignora tildes y mayúsculas en ambos sentidos", () => {
    expect(matchesSearch(row, "corporacion")).toBe(true);
    expect(matchesSearch(row, "CORPORACIÓN")).toBe(true);
    expect(matchesSearch(normalizeSearchText("Jesus Maria"), "jesús maría")).toBe(true);
  });

  it("exige todas las palabras, en cualquier orden y columna", () => {
    expect(matchesSearch(row, "real 2060")).toBe(true);
    expect(matchesSearch(row, "  facturas   corporacion ")).toBe(true);
    expect(matchesSearch(row, "real lima")).toBe(false);
  });

  it("una búsqueda vacía no filtra", () => {
    expect(matchesSearch(row, "")).toBe(true);
    expect(matchesSearch(row, "   ")).toBe(true);
  });
});
