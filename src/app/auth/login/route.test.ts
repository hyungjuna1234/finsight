import { beforeEach, describe, expect, it, vi } from "vitest";

const { startOAuthMock } = vi.hoisted(() => ({ startOAuthMock: vi.fn() }));
vi.mock("@/server/actions/auth", () => ({ startOAuth: startOAuthMock }));

import { GET } from "./route";

describe("GET /auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startOAuthMock.mockResolvedValue({ ok: true, url: "https://accounts.example/authorize" });
  });

  it("유효한 provider의 OAuth URL로 302 응답한다", async () => {
    const response = await GET(new Request("https://finsight.example/auth/login?provider=google&next=%2Fupload"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://accounts.example/authorize");
    expect(startOAuthMock).toHaveBeenCalledWith("google", "/upload");
  });

  it("유효하지 않은 provider를 로그인 화면으로 보낸다", async () => {
    const response = await GET(new Request("https://finsight.example/auth/login?provider=github"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://finsight.example/login?error=provider");
    expect(startOAuthMock).not.toHaveBeenCalled();
  });

  it("OAuth 시작 실패를 정해진 오류로 숨긴다", async () => {
    startOAuthMock.mockResolvedValue({ ok: false });
    const response = await GET(new Request("https://finsight.example/auth/login?provider=kakao"));
    expect(response.headers.get("location")).toBe("https://finsight.example/login?error=oauth");
  });
});
