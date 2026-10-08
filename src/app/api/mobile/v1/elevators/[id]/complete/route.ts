import { requireMobileUser } from "@/features/mobile/auth";
import { mobileRoute, ok, readJson } from "@/features/mobile/http";
import { completeElevator } from "@/features/mobile/service";

export const dynamic = "force-dynamic";

/** Finaliza el mantenimiento del equipo. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    const { id } = await params;
    const message = await completeElevator(user.id, id, await readJson(request));
    return ok({ message });
  });
}
