import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch, redirectPathForError } from "./api-fetch";

describe("apiFetch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends JSON and returns a successful JSON response", async () => {
    const fetchMock = vi.fn(async () => Response.json({ uploaded: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/api/uploads", { method: "POST", body: { name: "card.csv" } })).resolves.toEqual({
      uploaded: true,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "card.csv" }),
      signal: undefined,
    });
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));

    await expect(apiFetch<void>("/auth/signout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("throws the API error returned by the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: { code: "PRO_REQUIRED", message: "Pro에서 이용할 수 있어요." } }, { status: 402 }),
      ),
    );

    await expect(apiFetch("/api/insights", { method: "POST" })).rejects.toMatchObject({
      name: "ApiError",
      code: "PRO_REQUIRED",
      status: 402,
      message: "Pro에서 이용할 수 있어요.",
    });
  });

  it("normalizes network failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("private network detail"))));

    await expect(apiFetch("/api/uploads")).rejects.toMatchObject({
      name: "ApiError",
      code: "NETWORK",
      status: 0,
    });
  });

  it("rejects external URLs at runtime", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("https://evil.example" as "/api/bad")).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("redirectPathForError", () => {
  it.each([
    ["UNAUTHENTICATED", "/login?next=%2Fdashboard%3Fmonth%3D2026-09"],
    ["CONSENT_REQUIRED", "/onboarding/consent"],
    ["PRO_REQUIRED", "/pricing"],
    ["NOT_FOUND", null],
    ["NETWORK", null],
  ] as const)("maps %s to its redirect", (code, expected) => {
    expect(redirectPathForError(code, "/dashboard?month=2026-09")).toBe(expected);
  });
});
