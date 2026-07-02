import { beforeAll, describe, expect, it } from "vitest";

type SessionModule = typeof import("./session");
let m: SessionModule;

beforeAll(async () => {
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "$2a$10$test.hash.value.for.signing.key.only";
  m = await import("./session");
});

describe("session sign/verify", () => {
  it("round-trips a valid token", () => {
    const token = m.signSession({ sub: 7, username: "admin", role: "admin" });
    const payload = m.verifySession(token);
    expect(payload).toMatchObject({ sub: 7, username: "admin", role: "admin" });
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered signature", () => {
    const token = m.signSession({ sub: 1, username: "admin", role: "admin" });
    const [body] = token.split(".");
    expect(m.verifySession(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = m.signSession({ sub: 1, username: "admin", role: "admin" });
    const [, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: 1, username: "admin", role: "admin", exp: 9999999999 })).toString("base64url");
    expect(m.verifySession(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = m.signSession({ sub: 1, username: "admin", role: "admin" }, -10);
    expect(m.verifySession(token)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(m.verifySession(null)).toBeNull();
    expect(m.verifySession("")).toBeNull();
    expect(m.verifySession("garbage")).toBeNull();
  });
});
