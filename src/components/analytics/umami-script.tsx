/**
 * Self-hosted Umami tracker tag.
 *
 * Rendered by the RSC root layout, so the website id is read from the server
 * env at request time - `NEXT_PUBLIC_*` would be inlined when the image is
 * built in CI, long before the id exists in the Umami dashboard.
 *
 * Both the script and the collect endpoint come from our own origin (`/u/...`
 * rewrites in next.config.mjs): the site CSP allows only 'self' for script-src
 * and connect-src, and a third-party analytics host is what blocker lists hunt
 * for. `data-host-url` must be set explicitly - without it the tracker posts to
 * Umami Cloud (its built-in default), not to our instance.
 */
export function UmamiScript() {
  const websiteId = process.env.UMAMI_WEBSITE_ID?.trim();
  if (!websiteId) return null;

  return (
    <>
      <script
        defer
        src="/u/script.js"
        data-website-id={websiteId}
        data-host-url="/u"
        // Hash carries the profile tab / filter state; keeping it out leaves one
        // row per page instead of one per UI state.
        data-exclude-hash="true"
      />
      {/*
       * Session recording (replay + heatmaps). Same website id and same `/u`
       * proxy as the tracker - the vendor snippet points straight at the Umami
       * host, which the site CSP ('self' only) blocks.
       *
       * Whether anything is actually recorded is decided server-side: the
       * script fetches /api/websites/:id/recorder and stays idle unless
       * recording is enabled for the site in the Umami dashboard. Sample rate
       * and masking live there too, so this tag needs no flag of its own.
       */}
      <script defer src="/u/recorder.js" data-website-id={websiteId} data-host-url="/u" />
    </>
  );
}
