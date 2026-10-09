import { requireMobileUser } from "@/features/mobile/auth";
import { mobileRoute, ok } from "@/features/mobile/http";
import { removeAudio } from "@/features/mobile/service";

export const dynamic = "force-dynamic";

/** Elimina una nota de voz grabada por el técnico. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    const { id } = await params;
    return ok({ message: await removeAudio(user.id, id) });
  });
}
