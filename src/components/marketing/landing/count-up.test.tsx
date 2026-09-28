import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CountUp } from "./count-up";

describe("CountUp", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [119_100, "krw" as const, "₩119,100"],
    [41, "percent" as const, "41%"],
    [38, "signed-percent" as const, "+38%"],
    [-7, "signed-percent" as const, "−7%"],
  ])("renders the final value initially for %s %s", (value, format, expected) => {
    const { container } = render(<CountUp value={value} format={format} />);
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(expected);
    expect(container.querySelector(".sr-only")).toHaveTextContent(expected);
  });
});
