import { describe, expect, it } from "vitest";
import { CHART_COLORS, CHART_OTHER_COLOR } from "./chart-colors";

describe("chart colors", () => {
  it("provides eight hexadecimal category colors and an other color", () => {
    expect(CHART_COLORS).toHaveLength(8);
    for (const color of CHART_COLORS) expect(color).toMatch(/^#[0-9A-F]{6}$/);
    expect(CHART_OTHER_COLOR).toBe("#B3BBB6");
  });
});
