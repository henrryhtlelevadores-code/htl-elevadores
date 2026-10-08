import { randomUUID } from "crypto";
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_S3_API,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

async function putR2(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<string> {
  await R2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

export async function uploadToR2(
  key: string,
  body: Uint8Array,
  contentType: string
): Promise<string> {
  return putR2(key, body, contentType);
}

export async function deleteR2ObjectByUrl(url: string | null | undefined): Promise<void> {
  if (!url || !process.env.R2_BUCKET_NAME) return;
  const pathname = new URL(url).pathname.replace(/^\//, "");
  if (!pathname) return;
  await R2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: decodeURIComponent(pathname),
    })
  );
}

/**
 * @note Si en algún momento necesitas descargar el PDF con `fetch()` desde el
 * navegador (por ejemplo para mostrarlo en un `<iframe>` o generar un thumbnail),
 * configura CORS en el bucket R2 con:
 *
 *   {
 *     "AllowedOrigins": ["https://htl-elevadores.vercel.app", "http://localhost:3000"],
 *     "AllowedMethods": ["GET", "HEAD"],
 *     "AllowedHeaders": ["*"],
 *     "ExposeHeaders":  ["Content-Disposition"]
 *   }
 *
 * Mientras CORS esté deshabilitado, el cliente descarga con `<a download>`,
 * que no requiere CORS (la descarga se hace por navegación, no por fetch).
 */

export function buildEvidenceKey(
  workOrderId: string,
  elevatorId: string,
  index: number,
  ext: string
): string {
  const safe = INDEX_SAFE_REPLACEMENTS;
  const wo = workOrderId.replace(/-/g, "").toLowerCase().slice(0, 12);
  const ev = elevatorId.replace(/-/g, "").toLowerCase().slice(0, 12);
  const ts = Date.now();
  return `work-orders/${wo}/${ev}/${ts}-${safe(index)}.${ext}`;
}

export function buildSignatureKey(workOrderId: string): string {
  const wo = workOrderId.replace(/-/g, "").toLowerCase().slice(0, 12);
  return `work-orders/${wo}/client-signature.png`;
}

/** Foto etiquetada (antes/después/puntual) del flujo del técnico. */
export function buildElevatorPhotoKey(
  workOrderId: string,
  elevatorId: string,
  ext: string
): string {
  const wo = workOrderId.replace(/-/g, "").toLowerCase().slice(0, 12);
  const ev = elevatorId.replace(/-/g, "").toLowerCase().slice(0, 12);
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `work-orders/${wo}/${ev}/photos-${ts}-${rand}.${ext}`;
}

/** Firma del técnico en su perfil de personal. Usa un id propio para poder
 *  subirla antes de que el usuario exista (usuarios nuevos). */
export function buildStaffSignatureKey(signatureId: string): string {
  const id = signatureId.replace(/-/g, "").toLowerCase().slice(0, 24);
  return `staff/signatures/${id}.png`;
}

const INDEX_SAFE_REPLACEMENTS = (n: number) => String(n).padStart(2, "0");

// ==========================================
// PDFs PRIVADOS (contratos y cotizaciones)
// ==========================================
//
// Los PDFs de contratos y cotizaciones viven en un bucket SIN acceso público
// (`R2_PRIVATE_BUCKET_NAME`), con clave aleatoria, y solo se entregan mediante
// URLs firmadas de corta duración tras validar sesión y pertenencia.

/** Vigencia de las URLs firmadas, en segundos. */
export const SIGNED_PDF_URL_TTL_SECONDS = 5 * 60;

function privateBucket(): string {
  const bucket = process.env.R2_PRIVATE_BUCKET_NAME;
  if (!bucket) {
    throw new Error(
      "Almacenamiento privado de PDFs sin configurar: define R2_PRIVATE_BUCKET_NAME."
    );
  }
  if (bucket === process.env.R2_BUCKET_NAME) {
    throw new Error("R2_PRIVATE_BUCKET_NAME no puede ser el bucket público.");
  }
  return bucket;
}

export function isPrivatePdfStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_S3_API &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_PRIVATE_BUCKET_NAME &&
      process.env.R2_PRIVATE_BUCKET_NAME !== process.env.R2_BUCKET_NAME
  );
}

/** Clave nueva e impredecible: no se deriva del número de documento. */
export function newPrivatePdfKey(kind: "contracts" | "quotations"): string {
  return `${kind}/${randomUUID()}.pdf`;
}

export async function uploadPrivatePdf(key: string, buffer: Uint8Array): Promise<void> {
  await R2.send(
    new PutObjectCommand({
      Bucket: privateBucket(),
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    })
  );
}

export async function privatePdfExists(key: string): Promise<boolean> {
  try {
    await R2.send(new HeadObjectCommand({ Bucket: privateBucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function deletePrivatePdf(key: string | null | undefined): Promise<void> {
  if (!key) return;
  await R2.send(new DeleteObjectCommand({ Bucket: privateBucket(), Key: key }));
}

/**
 * URL firmada de corta duración para ver o descargar un PDF privado.
 * Quien llama debe haber validado antes sesión y pertenencia del recurso.
 */
export async function getSignedPdfUrl(
  key: string,
  options: { downloadName?: string } = {}
): Promise<string> {
  const safeName = options.downloadName?.replace(/[^A-Za-z0-9._-]+/g, "_");
  return getSignedUrl(
    R2,
    new GetObjectCommand({
      Bucket: privateBucket(),
      Key: key,
      ResponseContentType: "application/pdf",
      ResponseContentDisposition: safeName
        ? `attachment; filename="${safeName}"`
        : "inline",
    }),
    { expiresIn: SIGNED_PDF_URL_TTL_SECONDS }
  );
}

/** Clave dentro del bucket público a partir de su URL pública. */
export function publicKeyFromUrl(url: string): string | null {
  try {
    const key = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
    return key || null;
  } catch {
    return null;
  }
}

/**
 * Lee un objeto del bucket público por su URL. Solo para PDFs antiguos que
 * aún no se han movido al bucket privado: se sirven a través de la app, tras
 * validar la sesión, en lugar de entregar la URL pública.
 */
export async function readPublicObjectByUrl(url: string): Promise<Uint8Array | null> {
  const key = publicKeyFromUrl(url);
  if (!key || !process.env.R2_BUCKET_NAME) return null;
  const result = await R2.send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key })
  );
  return result.Body ? await result.Body.transformToByteArray() : null;
}

/** Borra el PDF guardado de un documento, esté en el bucket que esté. */
export async function deleteStoredPdf(stored: {
  url?: string | null;
  key?: string | null;
}): Promise<void> {
  for (const remove of [
    () => deletePrivatePdf(stored.key),
    () => deleteR2ObjectByUrl(stored.url),
  ]) {
    try {
      await remove();
    } catch (error) {
      console.warn("No se pudo eliminar un PDF anterior de R2:", error);
    }
  }
}
