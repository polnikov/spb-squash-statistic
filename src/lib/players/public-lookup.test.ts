import { describe, expect, it } from "vitest";
import {
  parseRankedinIdParam,
  playerLookupResponse,
  resolveBaseUrl,
} from "@/lib/players/public-lookup";

const headers = (init: Record<string, string>) => new Headers(init);

describe("parseRankedinIdParam", () => {
  it("rejects a missing id", () => {
    expect(parseRankedinIdParam(null)).toEqual({ ok: false, error: "rankedinId is required" });
  });

  it("rejects a blank id", () => {
    expect(parseRankedinIdParam("   ")).toEqual({ ok: false, error: "rankedinId is required" });
  });

  it("rejects an id longer than 64 characters", () => {
    expect(parseRankedinIdParam("R".repeat(65))).toEqual({
      ok: false,
      error: "rankedinId is too long",
    });
  });

  it("trims a valid id", () => {
    expect(parseRankedinIdParam("  R000064106 ")).toEqual({ ok: true, rankedinId: "R000064106" });
  });
});

describe("resolveBaseUrl", () => {
  it("prefers the configured site url and drops its trailing slash", () => {
    const base = resolveBaseUrl(headers({ host: "internal:3000" }), "https://bbrsquashspb.ohmyapps.xyz/");
    expect(base).toBe("https://bbrsquashspb.ohmyapps.xyz");
  });

  it("falls back to the forwarded host behind the proxy", () => {
    const base = resolveBaseUrl(
      headers({ "x-forwarded-proto": "https", "x-forwarded-host": "bbrsquashspb.ohmyapps.xyz", host: "app:3000" }),
      undefined,
    );
    expect(base).toBe("https://bbrsquashspb.ohmyapps.xyz");
  });

  it("falls back to the plain host on a direct dev request", () => {
    expect(resolveBaseUrl(headers({ host: "localhost:3000" }), undefined)).toBe("http://localhost:3000");
  });

  it("keeps a loopback host on http", () => {
    expect(resolveBaseUrl(headers({ host: "127.0.0.1:3000" }), undefined)).toBe("http://127.0.0.1:3000");
  });

  it("returns an empty base when the host is unknown", () => {
    expect(resolveBaseUrl(headers({}), undefined)).toBe("");
  });
});

describe("playerLookupResponse", () => {
  const base = "https://bbrsquashspb.ohmyapps.xyz";

  it("reports a miss when no player matched", () => {
    expect(playerLookupResponse(null, base)).toEqual({ found: false });
  });

  it("returns the profile link for a matched player", () => {
    const result = playerLookupResponse(
      { rankedinId: "R000064106", rankedinName: "KONSTANTIN BALABUSHKO", adminName: null },
      base,
    );
    expect(result).toEqual({
      found: true,
      player: {
        rankedinId: "R000064106",
        name: "Konstantin Balabushko",
        profileUrl: "https://bbrsquashspb.ohmyapps.xyz/players/R000064106",
        profilePath: "/players/R000064106",
      },
    });
  });

  it("links to the canonical id when the caller looked up an alias", () => {
    const result = playerLookupResponse(
      { rankedinId: "R000064106", rankedinName: "Konstantin Balabushko", adminName: null },
      base,
    );
    expect(result).toMatchObject({ player: { profilePath: "/players/R000064106" } });
  });

  it("prefers the admin name over the rankedin spelling", () => {
    const result = playerLookupResponse(
      { rankedinId: "R1", rankedinName: "Konstantin Balabushko", adminName: "  Константин Балабушко  " },
      base,
    );
    expect(result).toMatchObject({ player: { name: "Константин Балабушко" } });
  });

  it("reports a miss when the matched player has no canonical rankedin id", () => {
    expect(
      playerLookupResponse({ rankedinId: null, rankedinName: "Иван Петров", adminName: null }, base),
    ).toEqual({ found: false });
  });

  it("percent-encodes an id that is not url safe", () => {
    const result = playerLookupResponse({ rankedinId: "R 1/2", rankedinName: "Иван Петров", adminName: null }, base);
    expect(result).toMatchObject({ player: { profilePath: "/players/R%201%2F2" } });
  });

  it("keeps the link relative when the base url is unknown", () => {
    const result = playerLookupResponse({ rankedinId: "R1", rankedinName: "Иван Петров", adminName: null }, "");
    expect(result).toMatchObject({ player: { profileUrl: "/players/R1", profilePath: "/players/R1" } });
  });
});
