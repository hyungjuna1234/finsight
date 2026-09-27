import { describe, expect, it } from "vitest";

import { isProtectedPath, loginRedirectPath } from "./routes";

describe("isProtectedPath", () => {
  it.each([
    ["/dashboard", true],
    ["/dashboard/x", true],
    ["/dashboards", false],
    ["/upload", true],
    ["/upload/123", true],
    ["/uploading", false],
    ["/billing/success", true],
    ["/onboarding/consent", true],
    ["/login", false],
    ["/", false],
  ])("returns %s for %s", (pathname, expected) => {
    expect(isProtectedPath(pathname)).toBe(expected);
  });
});

describe("loginRedirectPath", () => {
  it.each([
    ["/dashboard", "", "/login?next=%2Fdashboard"],
    ["/transactions", "?month=2026-09", "/login?next=%2Ftransactions%3Fmonth%3D2026-09"],
  ])("combines and encodes pathname and search", (pathname, search, expected) => {
    expect(loginRedirectPath(pathname, search)).toBe(expected);
  });
});
