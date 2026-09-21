import { createHmac, timingSafeEqual } from "crypto";

export const PORTAL_SESSION_COOKIE = "htl_portal_session";
export const PORTAL_SESSION_TTL_SECONDS = 60 * 60 * 24;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET no está definido en el entorno.");
    }
    return "dev-secret-htl-elevadores-no-usar-en-produccion";
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createPortalSessionToken(costCenterId: string): {
  token: string;
  maxAge: number;
} {
  const exp = Math.floor(Date.now() / 1000) + PORTAL_SESSION_TTL_SECONDS;
  const payload = `${costCenterId}.${exp}`;
  return { token: `${payload}.${sign(payload)}`, maxAge: PORTAL_SESSION_TTL_SECONDS };
}

export function verifyPortalSessionToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [costCenterId, expStr, sig] = parts;

    const exp = Number(expStr);
    if (!Number.isFinite(exp)) return null;

    const expected = Buffer.from(sign(`${costCenterId}.${expStr}`), "hex");
    const provided = Buffer.from(sig, "hex");
    if (expected.length !== provided.length) return null;

    const equal = provided.length === 0 ? false : timingSafeEqual(expected, provided);
    if (!equal) return null;

    if (exp <= Math.floor(Date.now() / 1000)) return null;

    return costCenterId;
  } catch {
    return null;
  }
}