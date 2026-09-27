import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ removePrefix: vi.fn(), deleteUser: vi.fn(), revoke: vi.fn(), signOut: vi.fn(), createSb: vi.fn() }));
vi.mock("@/server/admin", () => ({ adminStorage: { removePrefix: mocks.removePrefix }, adminAuth: { deleteUser: mocks.deleteUser } }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: mocks.createSb }));
vi.mock("@/services/billing/polar", () => ({ revokeSubscriptions: mocks.revoke }));
import { USER_DATA_TABLES, deleteAccount, deleteAllData } from "./account";

const uid = "550e8400-e29b-41d4-a716-446655440000";
beforeEach(() => { vi.clearAllMocks(); mocks.removePrefix.mockResolvedValue(2); });

it("Storage를 먼저 지우고 사용자 데이터 테이블만 순서대로 삭제한다", async () => {
  const calls: string[] = [];
  mocks.removePrefix.mockImplementation(async () => { calls.push("storage"); return 2; });
  const from = vi.fn((table: string) => ({ delete: vi.fn(() => ({ eq: vi.fn(async (column, value) => { calls.push(table); expect(column).toBe("user_id"); expect(value).toBe(uid); return { error: null }; }) })) }));
  mocks.createSb.mockResolvedValue({ from });
  await deleteAllData(uid);
  expect(calls).toEqual(["storage", ...USER_DATA_TABLES]);
  expect(from.mock.calls.map(([table]) => table)).not.toEqual(expect.arrayContaining(["consents", "entitlements", "ai_usage"]));
});

it("Storage 실패 시 DB를 바꾸지 않는다", async () => {
  const from = vi.fn(); mocks.createSb.mockResolvedValue({ from }); mocks.removePrefix.mockRejectedValue(new Error("secret"));
  await expect(deleteAllData(uid)).rejects.toMatchObject({ code: "INTERNAL" });
  expect(from).not.toHaveBeenCalled();
});

it.each(["", "not-a-uuid"])("잘못된 사용자 ID %s를 즉시 거부한다", async (value) => {
  await expect(deleteAllData(value)).rejects.toMatchObject({ code: "INTERNAL" });
  expect(mocks.removePrefix).not.toHaveBeenCalled();
});

describe("deleteAccount", () => {
  beforeEach(() => {
    mocks.revoke.mockResolvedValue(2);
    mocks.removePrefix.mockResolvedValue(3);
    mocks.deleteUser.mockResolvedValue(undefined);
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createSb.mockResolvedValue({ auth: { signOut: mocks.signOut } });
  });

  it("구독, 파일, 사용자, 로컬 세션 순서로 삭제한다", async () => {
    const calls: string[] = [];
    mocks.revoke.mockImplementation(async () => { calls.push("revoke"); return 2; });
    mocks.removePrefix.mockImplementation(async () => { calls.push("storage"); return 3; });
    mocks.deleteUser.mockImplementation(async () => { calls.push("user"); });
    mocks.signOut.mockImplementation(async () => { calls.push("signOut"); return { error: null }; });
    await expect(deleteAccount(uid)).resolves.toEqual({ revoked: 2 });
    expect(calls).toEqual(["revoke", "storage", "user", "signOut"]);
    expect(mocks.removePrefix).toHaveBeenCalledWith(`${uid}/`);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("구독 해지 실패 시 결제 오류로 중단한다", async () => {
    mocks.revoke.mockRejectedValue(new Error("private"));
    await expect(deleteAccount(uid)).rejects.toMatchObject({ code: "BILLING_UNAVAILABLE" });
    expect(mocks.removePrefix).not.toHaveBeenCalled();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("Storage 실패 시 사용자 삭제를 막고 재호출로 완료할 수 있다", async () => {
    mocks.removePrefix.mockRejectedValueOnce(new Error("temporary"));
    await expect(deleteAccount(uid)).rejects.toThrow();
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    await expect(deleteAccount(uid)).resolves.toEqual({ revoked: 2 });
    expect(mocks.deleteUser).toHaveBeenCalledTimes(1);
  });

  it("사용자 삭제 뒤 signOut 오류는 무시한다", async () => {
    mocks.signOut.mockRejectedValue(new Error("missing user"));
    await expect(deleteAccount(uid)).resolves.toEqual({ revoked: 2 });
    expect(mocks.deleteUser).toHaveBeenCalledWith(uid);
  });

  it("잘못된 UUID는 외부 호출 전에 거부한다", async () => {
    await expect(deleteAccount("not-a-uuid")).rejects.toMatchObject({ code: "INTERNAL" });
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
});
