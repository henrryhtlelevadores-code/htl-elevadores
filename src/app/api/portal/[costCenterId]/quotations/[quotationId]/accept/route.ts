import { NextResponse } from "next/server";
import { getPortalSessionCostCenterId } from "@/features/portal/server";
import { acceptPortalQuotation } from "@/features/quotations/actions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ costCenterId: string; quotationId: string }> }
) {
  const { costCenterId, quotationId } = await params;
  const session = await getPortalSessionCostCenterId();
  if (session !== costCenterId) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }
  const result = await acceptPortalQuotation(quotationId, costCenterId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}