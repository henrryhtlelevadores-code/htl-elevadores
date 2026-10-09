/** Minúsculas y sin tildes, para que "corporacion" encuentre "Corporación". */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Indica si `text` (ya normalizado) contiene todas las palabras de `query`,
 * en cualquier orden: "real 2060" encuentra a "Corporación Real" con RUC 2060…
 */
export function matchesSearch(text: string, query: string): boolean {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  return words.every((word) => text.includes(word));
}
