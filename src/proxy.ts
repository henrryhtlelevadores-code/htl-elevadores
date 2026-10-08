import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/features/auth/session";
import {
  verifyPortalSessionToken,
  PORTAL_SESSION_COOKIE,
} from "@/features/portal/session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isLoginPage = pathname === "/login";
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionUserId = token ? verifySessionToken(token) : null;

  // Rutas del portal del cliente: requieren sesión propia del portal.
  if (pathname.startsWith("/portal")) {
    // El login y el logout del portal deben ser accesibles sin sesión.
    const portalMatch = /^\/portal\/([^/]+)(\/.*)?$/.exec(pathname);
    if (!portalMatch) {
      return NextResponse.next();
    }
    const [, costCenterId, rest] = portalMatch;
    if (rest === "/login" || rest === "/logout") {
      return NextResponse.next();
    }
    const portalToken = request.cookies.get(PORTAL_SESSION_COOKIE)?.value;
    const portalCostCenterId = portalToken ? verifyPortalSessionToken(portalToken) : null;
    if (!portalCostCenterId) {
      return NextResponse.redirect(new URL(`/portal/${costCenterId}/login`, request.url));
    }
    return NextResponse.next();
  }

  if (isLoginPage) {
    if (sessionUserId) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!sessionUserId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)",
  ],
};