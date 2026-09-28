import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track: mocks.track }));
import { LandingCta } from "./landing-cta";

beforeEach(() => vi.clearAllMocks());

it("keeps its href and tracks only the CTA and section", async () => {
  render(<LandingCta href="/demo?from=landing" cta="demo" section="hero" variant="secondary">예시 보기</LandingCta>);
  const link = screen.getByRole("link", { name: "예시 보기" });
  expect(link).toHaveAttribute("href", "/demo?from=landing");
  await userEvent.click(link);
  expect(mocks.track).toHaveBeenCalledOnce();
  expect(mocks.track).toHaveBeenCalledWith("landing_cta", { cta: "demo", section: "hero" });
});

it("applies the requested visual variant and shared accessible sizing", () => {
  render(<LandingCta href="/login" cta="start" section="final" variant="invert">시작하기</LandingCta>);
  expect(screen.getByRole("link")).toHaveClass("min-h-11", "bg-surface", "text-accent", "focus-visible:outline-white");
});
