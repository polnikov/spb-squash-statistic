/**
 * Thin wrapper over the Umami tracker.
 *
 * Every call is a no-op when the tracker is absent (no website id configured,
 * script blocked, SSR pass), so call sites never guard. Event names stay short
 * and stable - they become column values in the Umami dashboard.
 */

type UmamiTracker = {
  track: (event: string, data?: Record<string, string | number | boolean>) => void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

export function trackEvent(event: string, data?: Record<string, string | number | boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(event, data);
  } catch {
    // Analytics must never break the page: a blocked or half-loaded tracker is
    // an expected state, not an error worth surfacing.
  }
}
