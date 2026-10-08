import {
  createSessionToken as createToken,
  verifySessionToken as verifyToken,
  sessionCookieName,
  type SessionClaims,
} from "@/lib/session-token";

export const SESSION_COOKIE = sessionCookieName("staff");
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export function createSessionToken(
  userId: string,
  sessionVersion: number
): {
  token: string;
  maxAge: number;
} {
  return {
    token: createToken("staff", userId, sessionVersion, SESSION_TTL_SECONDS),
    maxAge: SESSION_TTL_SECONDS,
  };
}

/** Valida firma, tipo y expiración. No consulta la base de datos. */
export function verifySessionToken(token: string): SessionClaims | null {
  return verifyToken("staff", token);
}
