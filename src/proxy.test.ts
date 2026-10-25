import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { getClaimsMock, createRequestSupabaseMock } = vi.hoisted(() => {
  const getClaimsMock = vi.fn();
  return {
    getClaimsMock,
    createRequestSupabaseMock: vi.fn(() => ({ auth: { getClaims: getClaimsMock } })),
  };
});

vi.mock("@/services/supabase/server", () => ({
  createRequestSupabase: createRequestSupabaseMock,
}));

import { proxy } from "./proxy";

function makeRequest(pathname: string) {
  return new NextRequest(new URL(pathname, "http://localhost:3100"));
}

describe("proxy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("보호되지 않은 경로에서는 세션을 확인하지 않는다", async () => {
    const response = await proxy(makeRequest("/pricing"));
    expect(createRequestSupabaseMock).not.toHaveBeenCalled();
    expect(getClaimsMock).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBeNull();
  });

  it("보호된 경로에서 로그인하지 않았으면 로그인으로 리다이렉트한다", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: null }, error: { message: "no session" } });
    const response = await proxy(makeRequest("/dashboard"));
    expect(getClaimsMock).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe("http://localhost:3100/login?next=%2Fdashboard");
  });

  it("보호된 경로에서 로그인했으면 그대로 통과시킨다", async () => {
    getClaimsMock.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });
    const response = await proxy(makeRequest("/dashboard"));
    expect(getClaimsMock).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBeNull();
  });
});
