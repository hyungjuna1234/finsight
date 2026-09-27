import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseMock, requireUserMock, signOutMock } = vi.hoisted(() => ({
  createServerSupabaseMock: vi.fn(),
  requireUserMock: vi.fn(),
  signOutMock: vi.fn(),
}));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: createServerSupabaseMock }));
vi.mock("@/server/auth", () => ({ requireUser: requireUserMock }));
vi.mock("@/server/env", () => ({
  getPublicEnv: () => ({ appUrl: "https://finsight.example" }),
  getServerEnv: () => ({ cronSecret: "unused" }),
}));

import { POST } from "./route";

const route = { params: Promise.resolve({}) };

describe("POST /auth/signout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "user-1", email: null });
    createServerSupabaseMock.mockResolvedValue({ auth: { signOut: signOutMock } });
    signOutMock.mockResolvedValue({ error: null });
  });

  it("로그아웃 후 루트로 303 응답한다", async () => {
    const response = await POST(new Request("https://finsight.example/auth/signout", {
      method: "POST",
      headers: { origin: "https://finsight.example" },
    }), route);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://finsight.example/");
    expect(signOutMock).toHaveBeenCalledOnce();
  });

  it("다른 Origin을 거부한다", async () => {
    const response = await POST(new Request("https://finsight.example/auth/signout", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }), route);
    expect(response.status).toBe(403);
    expect(signOutMock).not.toHaveBeenCalled();
  });
});
