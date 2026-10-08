import { requireMobileUser } from "@/features/mobile/auth";
import { invalid, mobileRoute, ok } from "@/features/mobile/http";
import { addAudio } from "@/features/mobile/service";

export const dynamic = "force-dynamic";

/** Sube una nota de voz del equipo (multipart: file, id, durationMs, ...). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    const { id } = await params;
    const form = await request.formData().catch(() => {
      throw invalid("El cuerpo de la petición no es válido.");
    });
    const message = await addAudio(user.id, id, form);
    return ok({ message });
  });
}
