import { issueMobileToken, requireMobileUser } from "@/features/mobile/auth";
import { mobileRoute, ok } from "@/features/mobile/http";

export const dynamic = "force-dynamic";

/**
 * Cambia un token vigente por uno nuevo con la duración completa. La app lo
 * llama al abrirse con señal, para no quedarse sin sesión en mitad de una
 * jornada sin cobertura. Un token vencido o revocado responde 401.
 */
export async function POST() {
  return mobileRoute(async () => {
    const user = await requireMobileUser();
    return ok({
      ...issueMobileToken(user.id, user.sessionVersion),
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    });
  });
}
