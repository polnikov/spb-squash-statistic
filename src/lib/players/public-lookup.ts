/**
 * Public player lookup: the read-only contract a third-party app calls to find
 * out whether one of its people also plays in this league, and where to link.
 *
 * Served by /api/public/players/lookup. Everything except the DB hit is pure so
 * the link shape and the input rules stay testable without a database.
 */
import { findPlayerByRankedinId } from "@/lib/db/player-identity";
import { db as defaultDb, type Database } from "@/lib/db";
import { capitalizePlayerName } from "@/lib/format";

/** Longest RankedIn id we accept before calling it junk input. */
const MAX_RANKEDIN_ID_LENGTH = 64;

/** Hosts that are served over plain http, so `next dev` links stay clickable. */
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/;

/** Subset of a player row the response is built from. */
export type PublicLookupRow = {
  rankedinId: string | null;
  rankedinName: string;
  adminName: string | null;
};

export type PublicPlayer = {
  rankedinId: string;
  name: string;
  profileUrl: string;
  profilePath: string;
};

export type PublicLookupResult = { found: false } | { found: true; player: PublicPlayer };

export type ParsedRankedinId =
  | { ok: true; rankedinId: string }
  | { ok: false; error: string };

/**
 * Validate the `rankedinId` query parameter. No format regex on purpose: a
 * RankedIn id that does not look like `R000064106` should come back as "not
 * found", not as a 400 the caller cannot act on.
 */
export function parseRankedinIdParam(raw: string | null): ParsedRankedinId {
  const rankedinId = (raw ?? "").trim();
  if (!rankedinId) return { ok: false, error: "rankedinId is required" };
  if (rankedinId.length > MAX_RANKEDIN_ID_LENGTH) {
    return { ok: false, error: "rankedinId is too long" };
  }
  return { ok: true, rankedinId };
}

/**
 * Origin the profile link is built on: the configured site url first, then the
 * headers Caddy forwards, then the raw host (so `next dev` links to localhost
 * instead of production). Empty when nothing is known — the link then stays
 * relative rather than pointing at a guessed domain.
 */
export function resolveBaseUrl(headers: Headers, siteUrl: string | undefined | null): string {
  const configured = (siteUrl ?? "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return "";
  const proto = headers.get("x-forwarded-proto") ?? (LOOPBACK_HOST.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/** Display name, matching what the site itself shows: admin override, else the RankedIn spelling. */
function displayName(row: PublicLookupRow): string {
  return row.adminName?.trim() || capitalizePlayerName(row.rankedinName);
}

/**
 * Shape the response. A player reached through an alias links to the canonical
 * id, since that is the one `/players/:rid` renders. A player without a
 * canonical id has no profile page, so it counts as a miss.
 */
export function playerLookupResponse(row: PublicLookupRow | null, baseUrl: string): PublicLookupResult {
  if (!row?.rankedinId) return { found: false };

  const profilePath = `/players/${encodeURIComponent(row.rankedinId)}`;
  return {
    found: true,
    player: {
      rankedinId: row.rankedinId,
      name: displayName(row),
      profileUrl: `${baseUrl}${profilePath}`,
      profilePath,
    },
  };
}

/**
 * Resolve one RankedIn id against the league. Aliases are covered: RankedIn
 * hands out a new id when a profile is deleted and recreated, so a caller
 * holding a stale id still gets the right profile.
 */
export async function lookupPublicPlayer(
  rankedinId: string,
  baseUrl: string,
  database: Database = defaultDb,
): Promise<PublicLookupResult> {
  const row = await findPlayerByRankedinId(rankedinId, database);
  return playerLookupResponse(row, baseUrl);
}
