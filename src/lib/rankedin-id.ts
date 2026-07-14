/**
 * RankedIn player ids come in three shapes:
 *   R000027113    - a live profile;
 *   D105361_76068 - a player who deleted his profile. The stage still counts, but
 *                   his next entry arrives under a fresh id, so an admin has to
 *                   link the two by hand;
 *   F001420898    - a fake entry with no player behind it. It is dropped from the
 *                   import and there is nothing to link it to.
 *
 * Lives apart from the parser so the admin UI (a client component) can classify an
 * id without pulling the server-only import pipeline into the bundle.
 */

export function isFakeRankedinId(rankedinId: string) {
  return /^F\d+$/i.test(rankedinId.trim());
}

export function isLiveRankedinId(rankedinId: string) {
  return /^R\d+$/i.test(rankedinId.trim());
}

/** Anything that is neither a live profile nor a fake entry: a deleted profile. */
export function isDeletedRankedinProfile(rankedinId: string) {
  const id = rankedinId.trim();
  return Boolean(id) && !isLiveRankedinId(id) && !isFakeRankedinId(id);
}
