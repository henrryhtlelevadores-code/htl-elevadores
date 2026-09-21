"use client";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
    img.src = src;
  });
}

export interface CompressedImage {
  dataUrl: string;
  contentType: string;
}

export async function fileToCompressedDataUrl(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecciona una imagen válida.");
  }

  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { dataUrl, contentType: "image/jpeg" };
}