import { NextResponse } from "next/server";
import { authorizeApi } from "@/features/auth/api";
import { storeQuotationPdf } from "@/features/quotations/pdf";
import { pdfNotFound, redirectToSignedPdf } from "@/lib/pdf-response";

export const dynamic = "force-dynamic";

/** PDF de una cotización para el personal: redirige a una URL firmada. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("quotations:read");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await storeQuotationPdf(id);
  if (!result.success) {
    if (result.error === "Cotización no encontrada") return pdfNotFound();
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return redirectToSignedPdf(result.pdfKey, request);
}
