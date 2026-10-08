import { verifyCredentials } from "@/features/users/credentials";
import { issueMobileToken, mobileUserForLogin } from "@/features/mobile/auth";
import { MobileError, mobileRoute, ok, readJson, unauthorized } from "@/features/mobile/http";
import { getClientIp } from "@/lib/client-ip";
import {
  checkLoginAllowed,
  rateLimitMessage,
  recordLoginFailure,
  recordLoginSuccess,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Login de la app de técnicos. Pública por diseño. Devuelve un token que la
 * app envía después como `Authorization: Bearer`.
 *
 * Comparte el contador de intentos con el login del panel: fallar en la app
 * y en la web suma hacia el mismo bloqueo.
 */
export async function POST(request: Request) {
  return mobileRoute(async () => {
    const body = await readJson(request);
    const email = String(body.email ?? "").toLowerCase().trim().slice(0, 254);
    const password = String(body.password ?? "");
    const key = { scope: "staff", ip: await getClientIp(), identifier: email };

    // Antes de Argon2: una petición bloqueada no llega a hashear.
    const limit = await checkLoginAllowed(key);
    if (!limit.allowed) {
      throw new MobileError(429, rateLimitMessage(limit.retryAfterSeconds));
    }

    const verified = await verifyCredentials(email, password);
    if (!verified) {
      await recordLoginFailure(key);
      throw unauthorized("Credenciales inválidas. Verifica tu correo y contraseña.");
    }
    await recordLoginSuccess(key);

    // 403 si el rol no puede usar la app (p. ej. personal de oficina).
    const user = await mobileUserForLogin(verified.id);
    return ok({ ...issueMobileToken(verified.id, verified.sessionVersion), user });
  });
}
