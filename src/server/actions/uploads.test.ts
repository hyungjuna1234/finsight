import { beforeEach, describe, expect, it, vi } from "vitest";

const { categorizeTransactions, createServerSupabase } = vi.hoisted(() => ({
  categorizeTransactions: vi.fn(),
  createServerSupabase: vi.fn(),
}));

vi.mock("@/server/admin", () => ({
  adminStorage: { createUploadUrl: vi.fn(), read: vi.fn(), remove: vi.fn(), removePrefix: vi.fn() },
  storagePathFor: (userId: string, uploadId: string) => `${userId}/${uploadId}/original`,
}));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase }));
vi.mock("@/services/claude/mapper", () => ({ proposeMapping: vi.fn() }));
vi.mock("@/server/actions/categorize", () => ({ categorizeTransactions }));
vi.mock("@/server/limits", () => ({ assertDailyLimit: vi.fn(), recordAiUsage: vi.fn() }));

import { confirmUploadBody, createUploadBody, recategorizeUpload } from "./uploads";

describe("upload action schemas", () => {
  it("accepts only a safe create payload", () => {
    expect(createUploadBody.safeParse({ filename: "card.csv", size: 1, sha256: "a".repeat(64) }).success).toBe(true);
    expect(createUploadBody.safeParse({ filename: "card.csv", size: 1, sha256: "a".repeat(64), userId: "other" }).success).toBe(false);
  });

  it("requires a strict card choice", () => {
    const mapping = { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } };
    expect(confirmUploadBody.safeParse({ mapping, card: { name: " 내 카드 " } }).success).toBe(true);
    expect(confirmUploadBody.safeParse({ mapping, card: { name: "카드", id: crypto.randomUUID() } }).success).toBe(false);
  });
});

describe("upload categorization limits", () => {
  beforeEach(() => {
    categorizeTransactions.mockReset();
    createServerSupabase.mockReset();
  });

  it("분류 상한에 걸린 재분류는 counts를 갱신한 뒤 RATE_LIMITED를 던진다", async () => {
    const upload = {
      id: "3ae40653-f46b-48ee-a316-8717841740c6",
      user_id: "user-1",
      status: "done",
      counts: { inserted: 1, pending: 1 },
    };
    let call = 0;
    const client = {
      from: vi.fn(() => {
        call += 1;
        const current = call;
        const query = {
          select: vi.fn(() => query),
          update: vi.fn(() => query),
          eq: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({ data: upload, error: null })),
          then(resolve: (value: unknown) => unknown) {
            if (current === 2) return Promise.resolve(resolve({ data: [{ merchant_key: "미지 상점" }], error: null }));
            if (current === 3) return Promise.resolve(resolve({ count: 1, error: null }));
            return Promise.resolve(resolve({ error: null }));
          },
        };
        return query;
      }),
    };
    createServerSupabase.mockResolvedValue(client);
    categorizeTransactions.mockResolvedValue({
      byKey: new Map([["미지 상점", { category: "기타", source: "pending" }]]),
      usage: [], aiFailed: false, rateLimited: true,
    });

    await expect(recategorizeUpload("user-1", upload.id)).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
    expect(client.from).toHaveBeenLastCalledWith("uploads");
  });
});
