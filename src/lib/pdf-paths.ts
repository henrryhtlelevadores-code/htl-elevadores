/**
 * Rutas de la app por las que se ven los PDFs. El navegador nunca recibe la
 * URL del bucket: estas rutas validan sesión y pertenencia y redirigen a una
 * URL firmada de corta duración.
 */

const version = (generatedAt: number | null | undefined) =>
  generatedAt ? `?v=${generatedAt}` : "";

export function quotationPdfPath(quotationId: string, generatedAt?: number | null): string {
  return `/api/quotations/${quotationId}/pdf${version(generatedAt)}`;
}

export function contractPdfPath(contractId: string): string {
  return `/api/contracts/${contractId}/pdf`;
}

export function portalQuotationPdfPath(
  costCenterId: string,
  quotationId: string,
  generatedAt?: number | null
): string {
  return `/api/portal/${costCenterId}/quotations/${quotationId}/pdf${version(generatedAt)}`;
}

export function portalContractPdfPath(costCenterId: string, contractId: string): string {
  return `/api/portal/${costCenterId}/contracts/${contractId}/pdf`;
}

/** Añade `download=<nombre>` para forzar la descarga con ese nombre. */
export function withDownload(path: string, filename: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}download=${encodeURIComponent(filename)}`;
}
