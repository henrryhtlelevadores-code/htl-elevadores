import { requireMobileUser } from "@/features/mobile/auth";
import { mobileRoute, ok, readJson } from "@/features/mobile/http";
import { completeWorkOrder } from "@/features/mobile/service";

export const dynamic = "force-dynamic";

/** Cierra la orden con la firma de quien recibe. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    const { id } = await params;
    const message = await completeWorkOrder(user.id, id, await readJson(request));
    return ok({ message });
  });
}
