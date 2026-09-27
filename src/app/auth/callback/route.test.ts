import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, exchangeCodeForSessionMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  exchangeCodeForSessionMock: vi.fn(),
}));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: createServerSupabaseMock }));

import { GET } from "./route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerSupabaseMock.mockResolvedValue({ auth: { exchangeCodeForSession: exchangeCodeForSessionMock } });
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
  });

  it("code 교환 성공 후 안전한 next로 302 응답한다", async () => {
    const response = await GET(new Request("https://finsight.example/auth/callback?code=abc&next=%2Fupload"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://finsight.example/upload");
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("abc");
  });

  it("사용자 취소를 cancelled 오류로 보낸다", async () => {
    const response = await GET(new Request("https://finsight.example/auth/callback?error=access_denied"));
    expect(response.headers.get("location")).toBe("https://finsight.example/login?error=cancelled");
    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
  });

  it("교환 실패를 callback 오류로 보낸다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ error: new Error("private") });
    const response = await GET(new Request("https://finsight.example/auth/callback?code=abc"));
    expect(response.headers.get("location")).toBe("https://finsight.example/login?error=callback");
  });

  it("외부 next를 대시보드로 바꾼다", async () => {
    const response = await GET(new Request("https://finsight.example/auth/callback?code=abc&next=%2F%2Fevil.com"));
    expect(response.headers.get("location")).toBe("https://finsight.example/dashboard");
  });
});
