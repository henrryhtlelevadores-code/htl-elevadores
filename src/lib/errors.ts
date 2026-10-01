interface ErrorInfo {
  type: "unique" | "foreign_key" | "not_found" | "schema" | "unknown";
  message: string;
  field?: string;
}

/**
 * Razón real de un error de SQLite del tipo
 * `SQLITE_CONSTRAINT: ... <motivo>: <tabla>.<columna>`.
 * Sin esto el mensaje al usuario era genérico y una deriva de esquema
 * (columna que falta o sobra) se disfrazaba de "falta un campo del formulario".
 */
function sqliteReason(message: string): { reason: string; table?: string; field?: string } {
  const match = message.match(
    /(UNIQUE constraint failed|FOREIGN KEY constraint failed|NOT NULL constraint failed|CHECK constraint failed)[:\s]+([\w.]+)?/
  );
  if (!match) return { reason: "" };
  const target = match[2]?.split(".");
  return { reason: match[1], table: target?.[0], field: target?.[1] };
}

export function getErrorInfo(error: unknown): ErrorInfo {
  const message = error instanceof Error ? error.message : String(error);
  const { reason, table, field } = sqliteReason(message);

  if (reason === "UNIQUE constraint failed") {
    return {
      type: "unique",
      message: `Ya existe un registro con ese valor${field ? ` (${field})` : ""}. Por favor, use un valor diferente.`,
      field,
    };
  }

  if (reason === "FOREIGN KEY constraint failed") {
    return {
      type: "foreign_key",
      message:
        "No se puede realizar esta operación porque el registro está relacionado con otros datos.",
    };
  }

  if (reason === "NOT NULL constraint failed" || reason === "CHECK constraint failed") {
    // Los formularios ya validan con Zod, así que un NOT NULL aquí no es un
    // campo sin completar: casi siempre es una columna que el código no envía
    // o que ni siquiera existe en la base. Decirlo como si fuera el formulario
    // lleva al usuario a revisar campos que ya están bien.
    return {
      type: "schema",
      message: `Error interno al guardar: falta un dato obligatorio en la base de datos${
        table ? ` (${table}${field ? `.${field}` : ""})` : ""
      }. No es un problema de los datos que ingresaste; contacta al administrador.`,
      field,
    };
  }

  if (/no such (table|column)/i.test(message)) {
    const missing = message.match(/no such (table|column):\s*(\S+)/i);
    const kind = missing?.[1]?.toLowerCase() === "table" ? "la tabla" : "la columna";
    return {
      type: "schema",
      message: `Error interno: ${kind} ${missing?.[2] ?? ""} no existe en la base de datos. `
        + `Falta aplicar una migración; contacta al administrador.`,
    };
  }

  return {
    type: "unknown",
    message: "Ocurrió un error inesperado. Por favor, intente nuevamente.",
  };
}

export function getErrorMessage(error: unknown): string {
  return getErrorInfo(error).message;
}

/** `true` cuando el error es una violación de índice/constraint UNIQUE. */
export function isUniqueConstraintError(error: unknown): boolean {
  return getErrorInfo(error).type === "unique";
}

/**
 * Texto crudo del error, solo para logs. `getErrorMessage` a propósito oculta
 * los detalles internos, así que esto es lo que hay que registrar en consola.
 */
export function getErrorDetail(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}
