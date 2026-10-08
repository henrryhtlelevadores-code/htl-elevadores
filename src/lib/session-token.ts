import { createHmac, timingSafeEqual } from "crypto";

/**
 * Tokens de sesión firmados (HMAC-SHA256) con el formato
 * `v2.<type>.<subject>.<version>.<exp>.<firma>`.
 *
 * El tipo forma parte de lo firmado y cada tipo usa su propio secreto, así
 * que un token del portal nunca valida como sesión de personal ni al revés.
 * `version` permite revocar sesiones: se compara con el valor guardado en la
 * base (session_version) cada vez que se resuelve la sesión.
 */
export type SessionType = "staff" | "portal";

const TOKEN_FORMAT = "v2";

const SECRET_ENV: Record<SessionType, string> = {
  staff: "STAFF_SESSION_SECRET",
  portal: "PORTAL_SESSION_SECRET",
};

const DEV_SECRETS: Record<SessionType, string> = {
  staff: "dev-staff-secret-htl-no-usar-en-produccion",
  portal: "dev-portal-secret-htl-no-usar-en-produccion",
};

function getSecret(type: SessionType): string {
  const secret = process.env[SECRET_ENV[type]];
  if (process.env.NODE_ENV === "production") {
    if (!secret) {
      throw new Error(`${SECRET_ENV[type]} no está definido en el entorno.`);
    }
    const other: SessionType = type === "staff" ? "portal" : "staff";
    if (secret === process.env[SECRET_ENV[other]]) {
      throw new Error(
        "STAFF_SESSION_SECRET y PORTAL_SESSION_SECRET deben ser distintos."
      );
    }
    return secret;
  }
  return secret || DEV_SECRETS[type];
}

function sign(type: SessionType, payload: string): string {
  return createHmac("sha256", getSecret(type)).update(payload).digest("hex");
}

export interface SessionClaims {
  subject: string;
  version: number;
  /** Expiración en segundos Unix. */
  exp: number;
}

export function createSessionToken(
  type: SessionType,
  subject: string,
  version: number,
  ttlSeconds: number
): string {
  // El separador es ".", así que el sujeto no puede contenerlo.
  if (!subject || subject.includes(".")) {
    throw new Error("Sujeto de sesión inválido.");
  }
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${TOKEN_FORMAT}.${type}.${subject}.${version}.${exp}`;
  return `${payload}.${sign(type, payload)}`;
}

export function verifySessionToken(
  type: SessionType,
  token: string
): SessionClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 6) return null;
    const [format, tokenType, subject, versionStr, expStr, sig] = parts;
    if (format !== TOKEN_FORMAT || tokenType !== type || !subject) return null;

    const version = Number(versionStr);
    const exp = Number(expStr);
    if (!Number.isInteger(version) || version < 0 || !Number.isInteger(exp)) {
      return null;
    }

    const payload = `${format}.${tokenType}.${subject}.${versionStr}.${expStr}`;
    const expected = Buffer.from(sign(type, payload), "hex");
    const provided = Buffer.from(sig, "hex");
    if (provided.length === 0 || expected.length !== provided.length) return null;
    if (!timingSafeEqual(expected, provided)) return null;

    if (exp <= Math.floor(Date.now() / 1000)) return null;

    return { subject, version, exp };
  } catch {
    return null;
  }
}

/**
 * Nombre de la cookie de sesión. En producción lleva el prefijo `__Host-`,
 * que obliga a Secure + Path=/ sin Domain e impide que un subdominio la fije.
 * En desarrollo (http) ese prefijo haría que el navegador la rechace.
 */
export function sessionCookieName(type: SessionType): string {
  const base = type === "staff" ? "htl_staff_session" : "htl_portal_session";
  return process.env.NODE_ENV === "production" ? `__Host-${base}` : base;
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/** `true` cuando al token le queda menos de la mitad de su vida útil. */
export function shouldRenewSession(claims: SessionClaims, ttlSeconds: number): boolean {
  return claims.exp - Math.floor(Date.now() / 1000) < ttlSeconds / 2;
}
