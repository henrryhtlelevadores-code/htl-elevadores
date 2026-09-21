interface ErrorInfo {
  type: "unique" | "foreign_key" | "not_found" | "unknown";
  message: string;
  field?: string;
}

export function getErrorInfo(error: unknown): ErrorInfo {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("UNIQUE constraint failed")) {
    const fieldMatch = message.match(/(\w+\.\w+)/);
    return {
      type: "unique",
      message: `Ya existe un registro con ese valor. Por favor, use un valor diferente.`,
      field: fieldMatch ? fieldMatch[1].split(".")[1] : undefined,
    };
  }

  if (message.includes("FOREIGN KEY constraint failed")) {
    return {
      type: "foreign_key",
      message:
        "No se puede realizar esta operación porque el registro está relacionado con otros datos.",
    };
  }

  if (message.includes("NOT NULL constraint failed")) {
    return {
      type: "unique",
      message: "Faltan campos obligatorios. Por favor, complete todos los campos requeridos.",
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
