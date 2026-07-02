/**
 * Stateless admin session: an HMAC-signed cookie value. Runs in the Node
 * runtime only (server components / actions), so `node:crypto` is fine — the
 * gate is enforced there, not in Edge middleware.
 */

import crypto from "node:crypto";

// Cookie-signing key derived from the admin username + password HASH — no
// separate AUTH_SECRET env. Using the bcrypt hash (not the plaintext) gives a
// high-entropy key, so a leaked cookie can't be offline-cracked to recover the
// password even if it is weak. Changing the hash rotates all sessions. Computed
// per call so it always reflects the current env.
function secret(): string {
  const u = process.env.ADMIN_USERNAME ?? "";
  const h = process.env.ADMIN_PASSWORD_HASH ?? "";
  return h ? crypto.createHash("sha256").update(`${u}:${h}`).digest("hex") : "";
}

export const SESSION_COOKIE = "bbr_admin";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 12; // 12h

export type SessionPayload = {
  sub: number;
  username: string;
  role: string;
  exp: number;
};

function hmac(body: string): string {
  return crypto.createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signSession(
  data: Omit<SessionPayload, "exp">,
  maxAgeSec = SESSION_MAX_AGE_SEC,
): string {
  const payload: SessionPayload = { ...data, exp: Math.floor(Date.now() / 1000) + maxAgeSec };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body)}`;
}

export function verifySession(token?: string | null): SessionPayload | null {
  if (!token || !secret()) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
