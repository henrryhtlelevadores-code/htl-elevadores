import { randomBytes } from "crypto";

/**
 * Genera códigos cortos alfanuméricos aleatorios usando `crypto.randomBytes`
 * (sin sesgo de módulo relevante y sin colisiones predecibles como Math.random).
 */
export function generateShortCode(length = 6): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Número de documento aleatorio con el patrón `PREFIJO-PERIODO-CODIGO`,
 * por ejemplo `OT-2026-10-A7F3K9`.
 *
 * @param prefix  Prefijo del documento (OT, QT, CT, ...).
 * @param period  Periodo del documento (normalmente `YYYY-MM` o `YYYY`).
 */
export function generateDocumentNumber(prefix: string, period: string): string {
  return `${prefix}-${period}-${generateShortCode(6)}`;
}

/** Periodo `YYYY-MM` a partir de un epoch en segundos. */
export function monthPeriodFromUnix(seconds: number | null | undefined): string {
  const date = new Date((seconds ?? Math.floor(Date.now() / 1000)) * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Año `YYYY` a partir de un epoch en segundos. */
export function yearFromUnix(seconds: number | null | undefined): string {
  const date = new Date((seconds ?? Math.floor(Date.now() / 1000)) * 1000);
  return String(date.getUTCFullYear());
}

/**
 * Devuelve un número único dentro de un conjunto `used` (para generación en
 * lote) y lo agrega. La probabilidad de colisión con el resto de la base es
 * ínfima; el índice UNIQUE actúa como red de seguridad.
 */
export function uniqueDocumentNumber(
  prefix: string,
  period: string,
  used: Set<string>
): string {
  let candidate = generateDocumentNumber(prefix, period);
  while (used.has(candidate)) {
    candidate = generateDocumentNumber(prefix, period);
  }
  used.add(candidate);
  return candidate;
}
