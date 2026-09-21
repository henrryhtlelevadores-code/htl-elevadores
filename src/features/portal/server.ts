import "server-only";
import { cookies } from "next/headers";
import {
  createPortalSessionToken,
  verifyPortalSessionToken,
  PORTAL_SESSION_COOKIE,
} from "./session";

export async function createPortalSession(costCenterId: string) {
  const { token, maxAge } = createPortalSessionToken(costCenterId);
  const store = await cookies();
  store.set(PORTAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function destroyPortalSession() {
  const store = await cookies();
  store.set(PORTAL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getPortalSessionCostCenterId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PORTAL_SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyPortalSessionToken(token);
}