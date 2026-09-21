import { NextResponse, type NextRequest } from "next/server";
import { PORTAL_SESSION_COOKIE } from "@/features/portal/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: RouteContext<"/portal/[costCenterId]/logout">
) {
  const { costCenterId } = await ctx.params;

  const response = NextResponse.redirect(
    new URL(`/portal/${costCenterId}/login`, _req.url)
  );
  response.cookies.set(PORTAL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}