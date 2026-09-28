import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ trackEvent: vi.fn() }));

vi.mock("./track", async (importOriginal) => {
  const original = await importOriginal<typeof import("./track")>();
  return { ...original, trackEvent: mocks.trackEvent };
});

import { TrackedLink } from "./tracked-link";

describe("TrackedLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the href and tracks one event when clicked", async () => {
    render(
      <TrackedLink
        href="/demo"
        event="pro_teaser_click"
        eventProps={{ from: "trend" }}
        className="example"
      >
        예시 보기
      </TrackedLink>,
    );

    const link = screen.getByRole("link", { name: "예시 보기" });
    expect(link).toHaveAttribute("href", "/demo");
    expect(link).toHaveClass("example");

    await userEvent.click(link);

    expect(mocks.trackEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackEvent).toHaveBeenCalledWith("pro_teaser_click", {
      from: "trend",
    });
  });
});
