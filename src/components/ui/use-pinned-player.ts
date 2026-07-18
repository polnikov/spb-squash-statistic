"use client";

import * as React from "react";

// One pinned player per device: the visitor marks their own rating row so a
// floating bar can track it. Anonymous visitors have no server identity, so the
// choice lives only in localStorage keyed by the player rid.
const STORAGE_KEY = "bbr:rating:pinned-rid";

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function usePinnedPlayer() {
  // Start null on both server and first client render to avoid a hydration
  // mismatch; hydrate the stored value right after mount.
  const [pinnedRid, setPinnedRid] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPinnedRid(readStored());

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setPinnedRid(e.newValue);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = React.useCallback((rid: string) => {
    setPinnedRid((prev) => {
      const next = prev === rid ? null : rid;
      try {
        if (next === null) window.localStorage.removeItem(STORAGE_KEY);
        else window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage failures (private mode, quota); state still updates.
      }
      return next;
    });
  }, []);

  const isPinned = React.useCallback((rid: string) => pinnedRid === rid, [pinnedRid]);

  return { pinnedRid, isPinned, toggle };
}
