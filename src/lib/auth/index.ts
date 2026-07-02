/**
 * Admin authentication. The public app is open; only the admin area and write
 * actions are gated. Credentials check against the `users` table (bcrypt);
 * session is an HMAC-signed httpOnly cookie.
 */

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session";

export type { SessionPayload };

export async function login(username: string, password: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.trim()))
    .limit(1);
  if (!user) return false;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return false;

  cookies().set(SESSION_COOKIE, signSession({ sub: user.id, username: user.username, role: user.role }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  return true;
}

export function logout(): void {
  cookies().delete(SESSION_COOKIE);
}

export function getSession(): SessionPayload | null {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

export function isAdmin(): boolean {
  return getSession()?.role === "admin";
}

/** Throws when the caller is not an authenticated admin. Use in write actions. */
export function requireAdmin(): SessionPayload {
  const session = getSession();
  if (!session || session.role !== "admin") throw new Error("unauthorized");
  return session;
}
