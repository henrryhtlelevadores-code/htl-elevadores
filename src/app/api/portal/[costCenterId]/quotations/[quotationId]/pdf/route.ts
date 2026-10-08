import { NextResponse } from "next/server";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { getPortalQuotation } from "@/features/portal/quotations";
import { storeQuotationPdf } from "@/features/quotations/pdf";
import { pdfNotFound, redirectToSignedPdf } from "@/lib/pdf-response";

export const dynamic = "force-dynamic";

/** PDF de una cotización para el cliente del portal. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ costCenterId: string; quotationId: string }> }
) {
  const { costCenterId, quotationId } = await params;
  const session = await getPortalSessionCostCenterId();
  if (!session || session !== costCenterId) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  // Filtra por la sede de la sesión: una cotización ajena responde 404.
  const quotation = await getPortalQuotation(session, quotationId);
  if (!quotation) return pdfNotFound();

  const result = await storeQuotationPdf(quotation.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return redirectToSignedPdf(result.pdfKey, request);
}
