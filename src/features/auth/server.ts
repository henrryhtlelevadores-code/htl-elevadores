import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { createSessionToken, verifySessionToken, SESSION_COOKIE } from "./session";
import { users } from "@/db";
import { db } from "@/db";

export async function createSession(userId: string) {
  const { token, maxAge } = createSessionToken(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getSessionUser(): Promise<{
  id: string;
  fullName: string | null;
  email: string | null;
} | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  try {
    const [row] = await db
      .select({ id: users.id, fullName: users.fullName, email: users.email })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ?? { id, fullName: null, email: null };
  } catch {
    return { id, fullName: null, email: null };
  }
}
