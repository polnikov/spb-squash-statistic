import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findPlayerByRankedinId } = vi.hoisted(() => ({ findPlayerByRankedinId: vi.fn() }));
vi.mock("@/lib/db/player-identity", () => ({ findPlayerByRankedinId }));

import { GET, OPTIONS } from "./route";

const request = (url: string, headers: Record<string, string> = {}) =>
  new Request(url, { headers });

beforeEach(() => {
  findPlayerByRankedinId.mockReset();
  delete process.env.APP_URL;
});

afterEach(() => {
  delete process.env.APP_URL;
});

describe("OPTIONS /api/public/players/lookup", () => {
  it("answers the preflight with the cors headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
  });
});

describe("GET /api/public/players/lookup", () => {
  it("rejects a request without an id", async () => {
    const res = await GET(request("https://example.test/api/public/players/lookup"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "rankedinId is required" });
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(findPlayerByRankedinId).not.toHaveBeenCalled();
  });

  it("reports a miss with 200 so the caller parses one shape", async () => {
    findPlayerByRankedinId.mockResolvedValue(null);
    const res = await GET(request("https://example.test/api/public/players/lookup?rankedinId=R404"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ found: false });
  });

  it("returns the profile link built on the forwarded host", async () => {
    findPlayerByRankedinId.mockResolvedValue({
      id: 7,
      rankedinId: "R000064106",
      rankedinName: "Konstantin Balabushko",
      adminName: null,
    });
    const res = await GET(
      request("http://app:3000/api/public/players/lookup?rankedinId=R000064106", {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "bbrsquashspb.ohmyapps.xyz",
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      found: true,
      player: {
        rankedinId: "R000064106",
        name: "Konstantin Balabushko",
        profileUrl: "https://bbrsquashspb.ohmyapps.xyz/players/R000064106",
        profilePath: "/players/R000064106",
      },
    });
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("builds the link on the configured site url when it is set", async () => {
    process.env.APP_URL = "https://bbr.example/";
    findPlayerByRankedinId.mockResolvedValue({
      id: 7,
      rankedinId: "R1",
      rankedinName: "Иван Петров",
      adminName: null,
    });
    const res = await GET(request("http://app:3000/api/public/players/lookup?rankedinId=R1"));
    await expect(res.json()).resolves.toMatchObject({
      player: { profileUrl: "https://bbr.example/players/R1" },
    });
  });
});
