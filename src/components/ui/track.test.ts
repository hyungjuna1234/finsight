import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@vercel/analytics", () => ({ track: mocks.track }));

import { trackEvent } from "./track";

describe("trackEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the event name and props", () => {
    trackEvent("upload_done", { auto: true, first: false });

    expect(mocks.track).toHaveBeenCalledWith("upload_done", {
      auto: true,
      first: false,
    });
  });

  it("omits empty props", () => {
    trackEvent("demo_cta", {});

    expect(mocks.track).toHaveBeenCalledWith("demo_cta");
  });

  it("does not throw when analytics fails", () => {
    mocks.track.mockImplementationOnce(() => {
      throw new Error("analytics unavailable");
    });

    expect(() => trackEvent("link_copy", {})).not.toThrow();
  });
});
