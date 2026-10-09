import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/domain/errors";
import { AiCallError, type ClaudeUsage } from "@/services/claude/models";

const { classify, createServerSupabase, info, recordAiUsage, remainingDailyQuota, warn } = vi.hoisted(() => ({
  classify: vi.fn(),
  createServerSupabase: vi.fn(),
  info: vi.fn(),
  recordAiUsage: vi.fn(),
  remainingDailyQuota: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/services/claude/classifier", () => ({ classify }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase }));
vi.mock("@/server/limits", () => ({ recordAiUsage, remainingDailyQuota }));
vi.mock("@/server/logger", () => ({ logger: { info, warn } }));

import { categorizeTransactions } from "@/server/actions/categorize";

type Row = Record<string, unknown>;

function fakeClient(overrides: Row[], history: Row[]) {
  const calls: { table: string; eq: [string, unknown][]; inValues: string[][]; neq: [string, unknown][]; order: string[] }[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        const call = { table, eq: [] as [string, unknown][], inValues: [] as string[][], neq: [] as [string, unknown][], order: [] as string[] };
        calls.push(call);
        const query = {
          select: () => query,
          eq: (column: string, value: unknown) => { call.eq.push([column, value]); return query; },
          in: (_column: string, values: string[]) => { call.inValues.push(values); return query; },
          neq: (column: string, value: unknown) => { call.neq.push([column, value]); return query; },
          order: (column: string) => { call.order.push(column); return query; },
          then(resolve: (value: { data: Row[]; error: null }) => unknown) {
            return Promise.resolve(resolve({ data: table === "category_overrides" ? overrides : history, error: null }));
          },
        };
        return query;
      },
    },
  };
}

const usage = (n: number): ClaudeUsage => ({ model: "claude-haiku-4-5", inputTokens: n, outputTokens: n });

describe("categorizeTransactions", () => {
  beforeEach(() => {
    classify.mockReset();
    createServerSupabase.mockReset();
    info.mockReset();
    recordAiUsage.mockReset();
    recordAiUsage.mockResolvedValue(undefined);
    remainingDailyQuota.mockReset();
    remainingDailyQuota.mockResolvedValue(100);
    warn.mockReset();
  });

  it("override > history > rule > ai 우선순위를 고유 키마다 적용한다", async () => {
    const fake = fakeClient(
      [{ merchant_key: "쿠팡", category: "교육" }],
      [{ merchant_key: "스타벅스", category: "교통", occurred_on: "2026-09-02", created_at: "2026-09-02T00:00:00Z" }],
    );
    createServerSupabase.mockResolvedValue(fake.client);
    classify.mockResolvedValue({ categories: new Map([["미지상점", "쇼핑"]]), usage: usage(1) });

    const result = await categorizeTransactions("user-1", [
      { merchantKey: "쿠팡" }, { merchantKey: "스타벅스" }, { merchantKey: "GS25" },
      { merchantKey: "미지상점" }, { merchantKey: "미지상점" },
    ]);

    expect(result.byKey).toEqual(new Map([
      ["쿠팡", { category: "교육", source: "user" }],
      ["스타벅스", { category: "교통", source: "history" }],
      ["GS25", { category: "마트·편의점", source: "rule" }],
      ["미지상점", { category: "쇼핑", source: "ai" }],
    ]));
    expect(classify).toHaveBeenCalledWith(["미지상점"]);
    expect(recordAiUsage.mock.calls).toEqual([["user-1", "classify", usage(1)]]);
    for (const call of fake.calls) expect(call.eq).toContainEqual(["user_id", "user-1"]);
  });

  it("pending 이력을 제외하고 날짜·생성시각 기준 최신 분류를 사용하도록 조회한다", async () => {
    const fake = fakeClient([], [
      { merchant_key: "과거상점", category: "식비", occurred_on: "2026-09-03", created_at: "2026-09-03T08:00:00Z" },
      { merchant_key: "과거상점", category: "쇼핑", occurred_on: "2026-09-03", created_at: "2026-09-03T07:00:00Z" },
    ]);
    createServerSupabase.mockResolvedValue(fake.client);
    const result = await categorizeTransactions("user-1", [{ merchantKey: "과거상점" }]);
    expect(result.byKey.get("과거상점")).toEqual({ category: "식비", source: "history" });
    const txCall = fake.calls.find(({ table }) => table === "transactions")!;
    expect(txCall.neq).toContainEqual(["category_source", "pending"]);
    expect(txCall.order).toEqual(["occurred_on", "created_at"]);
  });

  it("250개의 남은 고유 키를 100·100·50개로 분류한다", async () => {
    const fake = fakeClient([], []);
    createServerSupabase.mockResolvedValue(fake.client);
    classify.mockImplementation(async (keys: string[]) => ({
      categories: new Map(keys.map((key) => [key, "기타"])), usage: usage(keys.length),
    }));
    const rows = Array.from({ length: 250 }, (_, i) => ({ merchantKey: `미지 상점 ${i}` }));
    const result = await categorizeTransactions("user-1", rows);
    expect(classify.mock.calls.map(([keys]) => keys.length)).toEqual([100, 100, 50]);
    expect(recordAiUsage.mock.calls).toEqual([
      ["user-1", "classify", usage(100)], ["user-1", "classify", usage(100)], ["user-1", "classify", usage(50)],
    ]);
    expect(result.aiFailed).toBe(false);
    for (const call of fake.calls) for (const values of call.inValues) expect(values.length).toBeLessThanOrEqual(100);
  });

  it("각 AI 배치의 사용량을 그 배치 직후에 기록해서, 뒤 배치가 끝나지 않아도 앞 배치는 기록돼 있다", async () => {
    createServerSupabase.mockResolvedValue(fakeClient([], []).client);
    classify
      .mockImplementationOnce(async (keys: string[]) => ({ categories: new Map(keys.map((key) => [key, "기타"])), usage: usage(100) }))
      .mockReturnValueOnce(new Promise(() => {}));
    const rows = Array.from({ length: 150 }, (_, i) => ({ merchantKey: `미지 상점 ${i}` }));

    void categorizeTransactions("user-1", rows);

    await vi.waitFor(() => expect(classify).toHaveBeenCalledTimes(2));
    expect(recordAiUsage.mock.calls).toEqual([["user-1", "classify", usage(100)]]);
  });

  it("Claude가 응답 뒤 실패해도 그 배치의 토큰을 기록하고 pending으로 둔다", async () => {
    createServerSupabase.mockResolvedValue(fakeClient([], []).client);
    classify.mockRejectedValueOnce(new AiCallError(usage(3)));
    const result = await categorizeTransactions("user-1", [{ merchantKey: "미지 상점" }]);
    expect(result.aiFailed).toBe(true);
    expect(recordAiUsage.mock.calls).toEqual([["user-1", "classify", usage(3)]]);
    expect(result.byKey.get("미지 상점")).toEqual({ category: "기타", source: "pending" });
  });

  it("사용량 기록이 실패하면 AI 실패로 숨기지 않고 에러를 그대로 낸다", async () => {
    createServerSupabase.mockResolvedValue(fakeClient([], []).client);
    classify.mockResolvedValue({ categories: new Map([["미지 상점", "쇼핑"]]), usage: usage(1) });
    recordAiUsage.mockRejectedValue(new AppError("INTERNAL"));

    await expect(categorizeTransactions("user-1", [{ merchantKey: "미지 상점" }])).rejects.toMatchObject({ code: "INTERNAL" });
    expect(warn).not.toHaveBeenCalledWith("categorize.ai_failed", expect.anything());
  });

  it("두 번째 AI 배치 실패 후 해당 배치와 이후 배치를 pending으로 두고 호출을 중단한다", async () => {
    const fake = fakeClient([], []);
    createServerSupabase.mockResolvedValue(fake.client);
    classify
      .mockImplementationOnce(async (keys: string[]) => ({ categories: new Map(keys.map((key) => [key, "기타"])), usage: usage(100) }))
      .mockRejectedValueOnce(new Error("timeout"));
    const rows = Array.from({ length: 250 }, (_, i) => ({ merchantKey: `미지 상점 ${i}` }));
    const result = await categorizeTransactions("user-1", rows);
    expect(classify).toHaveBeenCalledTimes(2);
    expect(result.aiFailed).toBe(true);
    expect(recordAiUsage.mock.calls).toEqual([["user-1", "classify", usage(100)]]);
    expect(result.byKey.get("미지 상점 100")).toEqual({ category: "기타", source: "pending" });
    expect(result.byKey.get("미지 상점 249")).toEqual({ category: "기타", source: "pending" });
    expect(warn).toHaveBeenCalledWith("categorize.ai_failed", { keys: 150 });
  });

  it("남은 분류 상한이 0이면 AI를 호출하지 않고 모두 pending으로 둔다", async () => {
    createServerSupabase.mockResolvedValue(fakeClient([], []).client);
    remainingDailyQuota.mockResolvedValue(0);

    const result = await categorizeTransactions("user-1", [{ merchantKey: "미지 상점" }]);

    expect(classify).not.toHaveBeenCalled();
    expect(result.byKey.get("미지 상점")).toEqual({ category: "기타", source: "pending" });
    expect(result.rateLimited).toBe(true);
    expect(info).toHaveBeenCalledWith("categorize.rate_limited", { keys: 1 });
  });

  it("남은 분류 상한이 1이면 세 배치 중 한 배치만 호출한다", async () => {
    createServerSupabase.mockResolvedValue(fakeClient([], []).client);
    remainingDailyQuota.mockResolvedValue(1);
    classify.mockImplementation(async (keys: string[]) => ({
      categories: new Map(keys.map((key) => [key, "기타"])), usage: usage(keys.length),
    }));
    const rows = Array.from({ length: 250 }, (_, i) => ({ merchantKey: `미지 상점 ${i}` }));

    const result = await categorizeTransactions("user-1", rows);

    expect(classify).toHaveBeenCalledTimes(1);
    expect(result.byKey.get("미지 상점 99")).toEqual({ category: "기타", source: "ai" });
    expect(result.byKey.get("미지 상점 100")).toEqual({ category: "기타", source: "pending" });
    expect(result.byKey.get("미지 상점 249")).toEqual({ category: "기타", source: "pending" });
    expect(result.rateLimited).toBe(true);
    expect(info).toHaveBeenCalledWith("categorize.rate_limited", { keys: 150 });
  });

  it("AI로 보낼 키가 없으면 분류 상한을 조회하지 않는다", async () => {
    createServerSupabase.mockResolvedValue(fakeClient([{ merchant_key: "쿠팡", category: "쇼핑" }], []).client);

    const result = await categorizeTransactions("user-1", [{ merchantKey: "쿠팡" }]);

    expect(result.byKey.get("쿠팡")).toEqual({ category: "쇼핑", source: "user" });
    expect(remainingDailyQuota).not.toHaveBeenCalled();
  });
});
