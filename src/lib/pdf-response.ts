import "server-only";
import { NextResponse } from "next/server";
import { getSignedPdfUrl, readPublicObjectByUrl } from "./r2";

const NO_STORE = { "Cache-Control": "private, no-store" };

function downloadName(request: Request): string | undefined {
  const name = new URL(request.url).searchParams.get("download");
  return name ? name.slice(0, 120) : undefined;
}

/**
 * Redirige a una URL firmada de corta duración del PDF privado. Quien llama
 * debe haber validado antes sesión y pertenencia del recurso.
 */
export async function redirectToSignedPdf(key: string, request: Request): Promise<NextResponse> {
  const url = await getSignedPdfUrl(key, { downloadName: downloadName(request) });
  return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
}

/**
 * PDFs antiguos que siguen en el bucket público: se sirven a través de la
 * app en lugar de entregar su URL pública.
 */
export async function streamLegacyPdf(publicUrl: string, request: Request): Promise<NextResponse> {
  const bytes = await readPublicObjectByUrl(publicUrl);
  if (!bytes) return pdfNotFound();
  const name = downloadName(request)?.replace(/[^A-Za-z0-9._-]+/g, "_");
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "application/pdf",
      "Content-Disposition": name ? `attachment; filename="${name}"` : "inline",
    },
  });
}

export function pdfNotFound(): NextResponse {
  return NextResponse.json({ error: "Documento no encontrado." }, { status: 404, headers: NO_STORE });
}
