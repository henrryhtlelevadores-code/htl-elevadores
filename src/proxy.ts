import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from "@/features/auth/session";
import {
  verifyPortalSessionToken,
  PORTAL_SESSION_COOKIE,
} from "@/features/portal/session";
import { sessionCookieOptions, shouldRenewSession } from "@/lib/session-token";
import { isCrossOriginMutation } from "@/lib/csrf";

/**
 * Primera barrera de navegación. Solo valida firma, tipo y expiración del
 * token (sin base de datos); la validación completa —usuario activo, versión
 * de sesión, permisos— se hace en cada página, acción y ruta API.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Defensa CSRF: ninguna petición que cambie estado puede venir de otro
  // origen. Cubre rutas API, formularios y server actions.
  if (
    isCrossOriginMutation({
      method: request.method,
      host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      origin: request.headers.get("origin"),
      secFetchSite: request.headers.get("sec-fetch-site"),
    })
  ) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  // Las rutas API se autentican y autorizan por sí mismas (401/403 en JSON);
  // aquí no se redirigen al login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Rutas del portal del cliente: requieren sesión propia del portal.
  if (pathname.startsWith("/portal")) {
    const portalMatch = /^\/portal\/([^/]+)(\/.*)?$/.exec(pathname);
    if (!portalMatch) {
      return NextResponse.next();
    }
    const [, costCenterId, rest] = portalMatch;
    // El login y el logout del portal deben ser accesibles sin sesión.
    if (rest === "/login" || rest === "/logout") {
      return NextResponse.next();
    }
    const portalToken = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
    const portalClaims = portalToken ? verifyPortalSessionToken(portalToken) : null;
    if (!portalClaims) {
      return NextResponse.redirect(new URL(`/portal/${costCenterId}/login`, request.url));
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? verifySessionToken(token) : null;

  if (pathname === "/login") {
    // No se redirige aunque haya token: si la sesión fue revocada, el layout
    // manda aquí y redirigir de vuelta provocaría un bucle.
    return NextResponse.next();
  }

  if (!claims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  // Renovación deslizante: conserva sujeto y versión, así que una sesión
  // revocada sigue siendo rechazada al resolverla contra la base.
  if (shouldRenewSession(claims, SESSION_TTL_SECONDS)) {
    const renewed = createSessionToken(claims.subject, claims.version);
    response.cookies.set(SESSION_COOKIE, renewed.token, sessionCookieOptions(renewed.maxAge));
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)",
  ],
};
