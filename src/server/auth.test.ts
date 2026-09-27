import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, getUserMock } = vi.hoisted(() => {
  const getUserMock = vi.fn();
  return {
    getUserMock,
    createServerSupabaseMock: vi.fn(async () => ({ auth: { getUser: getUserMock } })),
  };
});

vi.mock("@/services/supabase/server", () => ({ createServerSupabase: createServerSupabaseMock }));

import { getOptionalUser, requireUser } from "./auth";

describe("server auth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the trusted session user fields", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "me@example.com", user_metadata: { role: "ignored" } } },
      error: null,
    });

    await expect(requireUser()).resolves.toEqual({ id: "user-1", email: "me@example.com" });
    expect(getUserMock).toHaveBeenCalledOnce();
  });

  it("normalizes a missing email to null", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    await expect(getOptionalUser()).resolves.toEqual({ id: "user-1", email: null });
  });

  it.each([
    [{ data: { user: null }, error: null }],
    [{ data: { user: null }, error: new Error("invalid token") }],
  ])("returns null when authentication is unavailable", async (result) => {
    getUserMock.mockResolvedValue(result);

    await expect(getOptionalUser()).resolves.toBeNull();
  });

  it("throws UNAUTHENTICATED when no verified user exists", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });

    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });
});
