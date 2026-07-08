/**
 * Admin authentication. The public app is open; only the admin area and write
 * actions are gated. A single admin is defined by ADMIN_USERNAME and
 * ADMIN_PASSWORD_HASH (bcrypt) env vars; the session is an HMAC-signed httpOnly
 * cookie (key derived from the username + hash — see ./session).
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session";

export type { SessionPayload };

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function login(username: string, password: string): Promise<boolean> {
  const u = process.env.ADMIN_USERNAME ?? "";
  const hash = process.env.ADMIN_PASSWORD_HASH ?? "";
  if (!u || !hash) return false;
  if (!safeEqual(username.trim(), u)) return false;
  const okPass = await bcrypt.compare(password, hash);
  if (!okPass) return false;

  cookies().set(SESSION_COOKIE, signSession({ sub: 1, username: u, role: "admin" }), {
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

function getSession(): SessionPayload | null {
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
