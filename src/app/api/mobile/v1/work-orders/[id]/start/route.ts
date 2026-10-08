import { requireMobileUser } from "@/features/mobile/auth";
import { mobileRoute, ok, readJson } from "@/features/mobile/http";
import { startWorkOrder } from "@/features/mobile/service";

export const dynamic = "force-dynamic";

/** Inicia la orden y crea los checklists de seguridad. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    const { id } = await params;
    const message = await startWorkOrder(user.id, id, await readJson(request));
    return ok({ message });
  });
}
