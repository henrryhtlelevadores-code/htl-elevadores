import { and, eq, isNull } from "drizzle-orm";
import { db, contracts } from "@/db";
import { authorizeApi } from "@/features/auth/api";
import { pdfNotFound, redirectToSignedPdf, streamLegacyPdf } from "@/lib/pdf-response";

export const dynamic = "force-dynamic";

/** PDF final de un contrato para el personal. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("contracts:read");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const [contract] = await db
    .select({ finalPdfKey: contracts.finalPdfKey, finalPdfUrl: contracts.finalPdfUrl })
    .from(contracts)
    .where(and(eq(contracts.id, id), isNull(contracts.deletedAt)))
    .limit(1);

  if (contract?.finalPdfKey) return redirectToSignedPdf(contract.finalPdfKey, request);
  if (contract?.finalPdfUrl) return streamLegacyPdf(contract.finalPdfUrl, request);
  return pdfNotFound();
}
