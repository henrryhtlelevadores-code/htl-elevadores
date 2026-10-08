import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, contracts } from "@/db";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { pdfNotFound, redirectToSignedPdf, streamLegacyPdf } from "@/lib/pdf-response";

export const dynamic = "force-dynamic";

/** PDF final de un contrato para el cliente del portal. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ costCenterId: string; contractId: string }> }
) {
  const { costCenterId, contractId } = await params;
  const session = await getPortalSessionCostCenterId();
  if (!session || session !== costCenterId) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  // Filtra por la sede de la sesión: un contrato ajeno responde 404.
  const [contract] = await db
    .select({ finalPdfKey: contracts.finalPdfKey, finalPdfUrl: contracts.finalPdfUrl })
    .from(contracts)
    .where(
      and(
        eq(contracts.id, contractId),
        eq(contracts.costCenterId, session),
        isNull(contracts.deletedAt)
      )
    )
    .limit(1);

  if (contract?.finalPdfKey) return redirectToSignedPdf(contract.finalPdfKey, request);
  if (contract?.finalPdfUrl) return streamLegacyPdf(contract.finalPdfUrl, request);
  return pdfNotFound();
}
