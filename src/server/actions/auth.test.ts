import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, getPublicEnvMock, signInWithOAuthMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  getPublicEnvMock: vi.fn(() => ({ appUrl: "https://finsight.example" })),
  signInWithOAuthMock: vi.fn(),
}));

vi.mock("@/services/supabase/server", () => ({ createServerSupabase: createServerSupabaseMock }));
vi.mock("@/server/env", () => ({ getPublicEnv: getPublicEnvMock }));

import { startOAuth } from "./auth";

describe("startOAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerSupabaseMock.mockResolvedValue({ auth: { signInWithOAuth: signInWithOAuthMock } });
    signInWithOAuthMock.mockResolvedValue({ data: { url: "https://accounts.example/authorize" }, error: null });
  });

  it.each(["kakao", "google"] as const)("%s OAuth를 안전한 callback으로 시작한다", async (provider) => {
    await expect(startOAuth(provider, "/upload?from=login")).resolves.toEqual({
      ok: true,
      url: "https://accounts.example/authorize",
    });
    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider,
      options: {
        redirectTo: "https://finsight.example/auth/callback?next=%2Fupload%3Ffrom%3Dlogin",
      },
    });
  });

  it("외부 next를 기본 대시보드 경로로 바꾼다", async () => {
    await startOAuth("google", "//evil.example");
    expect(signInWithOAuthMock).toHaveBeenCalledWith(expect.objectContaining({
      options: { redirectTo: "https://finsight.example/auth/callback?next=%2Fdashboard" },
    }));
  });

  it("SDK 오류나 비어 있는 URL을 공개 오류로 바꾼다", async () => {
    signInWithOAuthMock.mockResolvedValueOnce({ data: { url: null }, error: new Error("private") });
    await expect(startOAuth("kakao", null)).resolves.toEqual({ ok: false });
  });
});
