import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingSection } from "./landing-section";

describe("LandingSection", () => {
  it.each([
    ["plain" as const, "py-14"],
    ["alt" as const, "bg-surface"],
    ["accent" as const, "bg-accent"],
  ])("renders identifiers and the %s tone", (tone, expectedClass) => {
    const { container } = render(<LandingSection id="tiles" tone={tone} labelledBy="tiles-title"><h2 id="tiles-title">제목</h2></LandingSection>);
    const section = container.querySelector("section");
    expect(section).toHaveAttribute("id", "tiles");
    expect(section).toHaveAttribute("data-landing-section", "tiles");
    expect(section).toHaveAttribute("aria-labelledby", "tiles-title");
    expect(section).toHaveClass(expectedClass);
    expect(screen.getByText("제목").parentElement).toHaveClass("max-w-5xl", "px-4");
  });
});
