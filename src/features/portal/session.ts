import {
  createSessionToken as createToken,
  verifySessionToken as verifyToken,
  sessionCookieName,
  type SessionClaims,
} from "@/lib/session-token";

export const PORTAL_SESSION_COOKIE = sessionCookieName("portal");
export const PORTAL_SESSION_TTL_SECONDS = 60 * 60 * 24;

export function createPortalSessionToken(
  costCenterId: string,
  sessionVersion: number
): {
  token: string;
  maxAge: number;
} {
  return {
    token: createToken("portal", costCenterId, sessionVersion, PORTAL_SESSION_TTL_SECONDS),
    maxAge: PORTAL_SESSION_TTL_SECONDS,
  };
}

/** Valida firma, tipo y expiración. No consulta la base de datos. */
export function verifyPortalSessionToken(token: string): SessionClaims | null {
  return verifyToken("portal", token);
}
