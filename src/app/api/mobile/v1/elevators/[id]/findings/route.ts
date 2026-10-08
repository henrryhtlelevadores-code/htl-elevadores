import { requireMobileUser } from "@/features/mobile/auth";
import { mobileRoute, ok, readJson } from "@/features/mobile/http";
import { saveFindings } from "@/features/mobile/service";

export const dynamic = "force-dynamic";

/** Guarda la nota de hallazgos del equipo. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    const { id } = await params;
    const message = await saveFindings(user.id, id, await readJson(request));
    return ok({ message });
  });
}
