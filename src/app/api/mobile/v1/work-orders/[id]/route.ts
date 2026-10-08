import { NextResponse } from "next/server";
import { requireMobileUser } from "@/features/mobile/auth";
import { mobileRoute } from "@/features/mobile/http";
import { getWorkOrder } from "@/features/mobile/service";

export const dynamic = "force-dynamic";

/** Detalle completo de una orden, listo para trabajarla sin señal. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    const { id } = await params;
    return NextResponse.json(await getWorkOrder(user.id, id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  });
}
