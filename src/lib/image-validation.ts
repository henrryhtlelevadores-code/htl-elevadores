/**
 * Validación de imágenes subidas. El tipo se decide por los primeros bytes
 * del archivo (magic bytes), nunca por el `Content-Type` ni por la extensión
 * que envía el cliente. SVG queda fuera a propósito: puede llevar scripts.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface DetectedImage {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((value, index) => bytes[offset + index] === value);

/** Devuelve el tipo real de la imagen o `null` si no es JPEG, PNG ni WebP. */
export function detectImageType(bytes: Uint8Array): DetectedImage | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  // RIFF....WEBP
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

export type ImageValidation =
  | { ok: true; image: DetectedImage }
  | { ok: false; error: string };

export function validateImageUpload(bytes: Uint8Array): ImageValidation {
  if (bytes.byteLength === 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, error: "La imagen supera el tamaño máximo de 5 MB." };
  }
  const image = detectImageType(bytes);
  if (!image) {
    return { ok: false, error: "Formato no permitido. Usa una imagen JPG, PNG o WebP." };
  }
  return { ok: true, image };
}
