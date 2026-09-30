import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, roles, users, workOrders } from "@/db";
import { getSessionUserId } from "@/features/auth/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const [user] = await db
    .select({ id: users.id, roleName: roles.name })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.roleName?.toUpperCase().includes("ADMIN")) {
    return NextResponse.json(
      { error: "Solo un administrador puede aprobar reportes." },
      { status: 403 }
    );
  }

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
