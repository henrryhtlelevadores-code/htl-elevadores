import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, workOrders } from "@/db";
import { authorizeApi } from "@/features/auth/api";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("reports:approve");
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { id } = await params;
  const [workOrder] = await db
    .select({ status: workOrders.status, approvalStatus: workOrders.approvalStatus })
    .from(workOrders)
    .where(and(eq(workOrders.id, id), eq(workOrders.status, "COMPLETED")))
    .limit(1);

  if (!workOrder) {
    return NextResponse.json(
      { error: "Solo se pueden aprobar OTs completadas." },
      { status: 409 }
    );
  }

  if (workOrder.approvalStatus === "APPROVED") {
    return NextResponse.json({ error: "La OT ya fue aprobada." }, { status: 409 });
  }

  await db
    .update(workOrders)
    .set({
      approvalStatus: "APPROVED",
      approvedBy: user.id,
      approvedAt: Date.now(),
    })
    .where(eq(workOrders.id, id));

  return NextResponse.json({ success: true });
}
