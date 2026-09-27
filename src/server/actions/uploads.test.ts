import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/admin", () => ({
  adminStorage: { createUploadUrl: vi.fn(), read: vi.fn(), remove: vi.fn(), removePrefix: vi.fn() },
  storagePathFor: (userId: string, uploadId: string) => `${userId}/${uploadId}/original`,
}));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/services/claude/mapper", () => ({ proposeMapping: vi.fn() }));
vi.mock("@/server/actions/categorize", () => ({ categorizeTransactions: vi.fn() }));
vi.mock("@/server/limits", () => ({ assertDailyLimit: vi.fn(), recordAiUsage: vi.fn() }));

import { confirmUploadBody, createUploadBody } from "./uploads";

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
