import { requireMobileUser } from "@/features/mobile/auth";
import { mobileRoute, ok, readJson } from "@/features/mobile/http";
import { saveSafetyItems } from "@/features/mobile/service";

export const dynamic = "force-dynamic";

/** Guarda respuestas del checklist de seguridad (en lote). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    const { id } = await params;
    const message = await saveSafetyItems(user.id, id, await readJson(request));
    return ok({ message });
  });
}
