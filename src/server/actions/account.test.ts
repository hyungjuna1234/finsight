import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ removePrefix: vi.fn(), createSb: vi.fn() }));
vi.mock("@/server/admin", () => ({ adminStorage: { removePrefix: mocks.removePrefix } }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: mocks.createSb }));
import { USER_DATA_TABLES, deleteAllData } from "./account";

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
