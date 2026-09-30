/**
 * Utilidades compartidas para el contenido de los templates de seguridad.
 * El admin guarda el checklist como un JSON de ítems ({ label, isCritical }),
 * pero las migraciones y formularios antiguos pueden haber dejado el JSON
 * doblemente codificado (cadena de cadena), así que la lectura es tolerante.
 */

/** Resuelve el contenido a una lista de ítems, tolerando doble codificación. */
export function parseChecklistItems(content: unknown): unknown[] {
  let current: unknown = content;
  for (let depth = 0; depth < 3; depth++) {
    if (Array.isArray(current)) return current;
    if (typeof current !== "string") return [];
    try {
      current = JSON.parse(current);
    } catch {
      return [];
    }
  }
  return [];
}

/** Extrae el texto de la pregunta de un ítem del template. */
export function checklistQuestion(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    const label = (item as { label?: unknown }).label;
    if (typeof label === "string") return label;
  }
  return "";
}