import { requireMobileUser } from "@/features/mobile/auth";
import { mobileRoute, ok } from "@/features/mobile/http";
import { listWorkOrders } from "@/features/mobile/service";

export const dynamic = "force-dynamic";

/** Órdenes de trabajo asignadas al técnico. */
export async function GET() {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    return ok({ workOrders: await listWorkOrders(user.id) });
  });
}
