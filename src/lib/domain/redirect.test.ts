import { describe, expect, it } from "vitest";

import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it.each([
    ["/", "/"],
    ["/dashboard?month=2026-09#summary", "/dashboard?month=2026-09#summary"],
    [null, "/dashboard"],
    [undefined, "/dashboard"],
    ["", "/dashboard"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["\\\\evil", "/dashboard"],
    ["https://evil.com", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["/dash board", "/dashboard"],
    ["/dashboard\n", "/dashboard"],
  ])("%j를 %s로 정리한다", (target, expected) => {
    expect(safeRedirect(target)).toBe(expected);
  });

  it("지정한 fallback을 사용한다", () => {
    expect(safeRedirect("//evil.com", "/login")).toBe("/login");
  });
});
