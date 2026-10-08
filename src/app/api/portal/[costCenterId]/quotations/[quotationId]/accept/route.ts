import { NextResponse } from "next/server";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { acceptPortalQuotation } from "@/features/portal/quotations";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ costCenterId: string; quotationId: string }> }
) {
  const { costCenterId, quotationId } = await params;
  const session = await getPortalSessionCostCenterId();
  if (!session || session !== costCenterId) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
  // Se usa la sede de la sesión, no la de la URL.
  const result = await acceptPortalQuotation(session, quotationId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
