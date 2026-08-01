import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "./analytics";

afterEach(() => {
  delete window.umami;
});

describe("trackEvent", () => {
  it("passes the event and its data to the tracker", () => {
    const track = vi.fn();
    window.umami = { track };
    trackEvent("divisions-tab", { division: 2 });
    expect(track).toHaveBeenCalledWith("divisions-tab", { division: 2 });
  });

  it("stays silent when the tracker is absent (blocked or not configured)", () => {
    expect(() => trackEvent("divisions-tab")).not.toThrow();
  });

  it("swallows tracker errors - analytics must never break the page", () => {
    window.umami = {
      track: () => {
        throw new Error("blocked");
      },
    };
    expect(() => trackEvent("stage-import")).not.toThrow();
  });
});
