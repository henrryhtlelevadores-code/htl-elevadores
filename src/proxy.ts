import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/features/auth/session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // El Portal del Cliente usa su propio sistema de sesión (htl_portal_session).
  if (pathname.startsWith("/portal")) {
    return NextResponse.next();
  }

  const isLoginPage = pathname === "/login";

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionUserId = token ? verifySessionToken(token) : null;

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