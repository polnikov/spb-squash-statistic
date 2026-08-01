import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { UmamiScript } from "./umami-script";

const ORIGINAL_ID = process.env.UMAMI_WEBSITE_ID;

afterEach(() => {
  if (ORIGINAL_ID === undefined) delete process.env.UMAMI_WEBSITE_ID;
  else process.env.UMAMI_WEBSITE_ID = ORIGINAL_ID;
});

describe("UmamiScript", () => {
  it("renders nothing without a website id (local dev, CI, fresh server)", () => {
    delete process.env.UMAMI_WEBSITE_ID;
    expect(renderToStaticMarkup(<UmamiScript />)).toBe("");
  });

  it("renders nothing for a blank id (empty env var in compose)", () => {
    process.env.UMAMI_WEBSITE_ID = "   ";
    expect(renderToStaticMarkup(<UmamiScript />)).toBe("");
  });

  it("serves script and collect endpoint from our own origin", () => {
    process.env.UMAMI_WEBSITE_ID = "b3c4d5e6-0000-4a1b-9c2d-77aa88bb99cc";
    const html = renderToStaticMarkup(<UmamiScript />);
    expect(html).toContain('src="/u/script.js"');
    // Without data-host-url the tracker posts to Umami Cloud, not to us.
    expect(html).toContain('data-host-url="/u"');
    expect(html).toContain('data-website-id="b3c4d5e6-0000-4a1b-9c2d-77aa88bb99cc"');
  });
});
