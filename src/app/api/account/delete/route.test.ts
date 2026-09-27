import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/domain/errors";

const mocks = vi.hoisted(() => ({ deleteAccount: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/server/actions/account", () => ({ deleteAccount: mocks.deleteAccount }));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser, requireConsent: vi.fn() }));
vi.mock("@/server/env", () => ({ getPublicEnv: () => ({ appUrl: "http://localhost:3000" }), getServerEnv: vi.fn() }));

import { POST, maxDuration } from "./route";

function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/account/delete", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440000" });
  mocks.deleteAccount.mockResolvedValue({ revoked: 1 });
});

it("maxDuration은 60초이고 정확한 확인 문구만 허용한다", async () => {
  expect(maxDuration).toBe(60);
  expect((await POST(request({ confirm: "전체 삭제" }), { params: Promise.resolve({}) })).status).toBe(400);
});

it("다른 Origin을 거부한다", async () => {
  expect((await POST(request({ confirm: "탈퇴" }, "https://evil.test"), { params: Promise.resolve({}) })).status).toBe(403);
  expect(mocks.deleteAccount).not.toHaveBeenCalled();
});

it("탈퇴 후 204를 반환하며 동의를 요구하지 않는다", async () => {
  const response = await POST(request({ confirm: "탈퇴" }), { params: Promise.resolve({}) });
  expect(response.status).toBe(204);
  expect(mocks.deleteAccount).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440000");
});

it("구독 해지 실패를 503으로 변환한다", async () => {
  mocks.deleteAccount.mockRejectedValue(new AppError("BILLING_UNAVAILABLE"));
  expect((await POST(request({ confirm: "탈퇴" }), { params: Promise.resolve({}) })).status).toBe(503);
});
