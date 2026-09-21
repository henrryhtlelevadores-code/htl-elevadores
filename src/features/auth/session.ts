import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "htl_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

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

export function createSessionToken(userId: string): {
  token: string;
  maxAge: number;
} {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${userId}.${exp}`;
  return { token: `${payload}.${sign(payload)}`, maxAge: SESSION_TTL_SECONDS };
}

export function verifySessionToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [userId, expStr, sig] = parts;

    const exp = Number(expStr);
    if (!Number.isFinite(exp)) return null;

    const expected = Buffer.from(sign(`${userId}.${expStr}`), "hex");
    const provided = Buffer.from(sig, "hex");
    if (expected.length !== provided.length) return null;

    const equal =
      provided.length === 0
        ? false
        : timingSafeEqual(expected, provided);
    if (!equal) return null;

    if (exp <= Math.floor(Date.now() / 1000)) return null;

    return userId;
  } catch {
    return null;
  }
}