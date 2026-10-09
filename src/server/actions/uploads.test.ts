import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recordAiUsage } from "@/server/limits";
import { AiCallError } from "@/services/claude/models";
import { syntheticPdf } from "@/test/fixtures/pdf";

const { categorizeTransactions, createServerSupabase, createUploadUrl, proposeMapping, storageRead, uploadsCreate } = vi.hoisted(() => ({
  createUploadUrl: vi.fn(),
  uploadsCreate: vi.fn(),
  categorizeTransactions: vi.fn(),
  createServerSupabase: vi.fn(),
  proposeMapping: vi.fn(),
  storageRead: vi.fn(),
}));

vi.mock("@/server/admin", () => ({
  adminStorage: { createUploadUrl, read: storageRead, remove: vi.fn(), removePrefix: vi.fn() },
  adminUploads: { create: uploadsCreate },
  storagePathFor: (userId: string, uploadId: string) => `${userId}/${uploadId}/original`,
}));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase }));
vi.mock("@/services/claude/mapper", () => ({ proposeMapping }));
vi.mock("@/server/actions/categorize", () => ({ categorizeTransactions }));
vi.mock("@/server/limits", () => ({ assertDailyLimit: vi.fn(), recordAiUsage: vi.fn() }));

import { analyzeUpload, analyzeUploadBody, confirmUploadBody, createUpload, createUploadBody, recategorizeUpload } from "./uploads";

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

  it("accepts an optional PDF password with a length cap", () => {
    const mapping = { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } };
    expect(analyzeUploadBody.safeParse({}).success).toBe(true);
    expect(analyzeUploadBody.safeParse({ password: "900101" }).success).toBe(true);
    expect(analyzeUploadBody.safeParse({ password: "" }).success).toBe(false);
    expect(analyzeUploadBody.safeParse({ password: "x".repeat(129) }).success).toBe(false);
    expect(analyzeUploadBody.safeParse({ password: "0", userId: "other" }).success).toBe(false);
    expect(confirmUploadBody.safeParse({ mapping, card: { name: "카드" }, password: "0" }).success).toBe(true);
  });
});

describe("PDF analyze", () => {
  const uploadId = "3ae40653-f46b-48ee-a316-8717841740c6";
  const pdf = syntheticPdf([[
    { text: "Period 2026.08.10 ~ 2026.09.09", x: 200, y: 815 },
    { text: "08/20 STARBUCKS", x: 36, y: 770 }, { text: "12,900", x: 250, y: 770 }, { text: "12,900", x: 380, y: 770 },
    { text: "08/21 GS25", x: 36, y: 757 }, { text: "3,000", x: 254, y: 757 }, { text: "3,000", x: 384, y: 757 },
  ]], { password: "900101" });
  let updates: Record<string, unknown>[];

  beforeEach(() => {
    updates = [];
    proposeMapping.mockReset();
    storageRead.mockReset().mockResolvedValue(pdf);
    const upload = { id: uploadId, user_id: "user-1", status: "uploaded", filename: "statement.pdf", storage_path: `user-1/${uploadId}/original`, sha256: createHash("sha256").update(pdf).digest("hex"), mapping: null };
    createServerSupabase.mockReset().mockResolvedValue({
      from: vi.fn((table: string) => {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          update: vi.fn((values: Record<string, unknown>) => { updates.push(values); return query; }),
          maybeSingle: vi.fn(async () => ({ data: table === "uploads" ? upload : null, error: null })),
          then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ error: null })); },
        };
        return query;
      }),
    });
  });

  it.each([
    [undefined, "PDF_PASSWORD_REQUIRED"],
    ["000000", "PDF_PASSWORD_WRONG"],
  ] as const)("asks again without failing the upload (password %s)", async (password, code) => {
    await expect(analyzeUpload("user-1", uploadId, { password })).rejects.toMatchObject({ code, status: 422 });
    expect(updates).toEqual([]);
  });

  it("opens the PDF with the password and suggests a mapping without calling Claude", async () => {
    const result = await analyzeUpload("user-1", uploadId, { password: "900101" });
    expect(result.mapping).toEqual({ headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } });
    expect(result.autoConfirm).toBe(false);
    expect(result.preview.rows).toEqual([
      ["이용일", "이용하신 곳", "열 3", "열 4"],
      ["08/20", "STARBUCKS", "12,900", "12,900"],
      ["08/21", "GS25", "3,000", "3,000"],
    ]);
    expect(proposeMapping).not.toHaveBeenCalled();
    expect(updates).toEqual([expect.objectContaining({ status: "awaiting_confirm", mapping: result.mapping })]);
    expect(JSON.stringify(updates)).not.toContain("900101");
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
      aiFailed: false, rateLimited: true,
    });

    await expect(recategorizeUpload("user-1", upload.id)).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
    expect(client.from).toHaveBeenLastCalledWith("uploads");
  });
});

describe("analyze mapping usage", () => {
  const uploadId = "5b0f4e8e-2c1d-4f6a-9b3e-0d2c4a6b8e10";
  const csv = new TextEncoder().encode("이용일,가맹점,금액\n2026-09-01,가게,1000\n2026-09-02,다른 가게,2000\n2026-09-03,세번째,3000\n");

  beforeEach(() => {
    proposeMapping.mockReset();
    vi.mocked(recordAiUsage).mockReset();
    storageRead.mockReset().mockResolvedValue(csv);
    const upload = { id: uploadId, user_id: "user-1", status: "uploaded", filename: "card.csv", storage_path: `user-1/${uploadId}/original`, sha256: createHash("sha256").update(csv).digest("hex"), mapping: null };
    createServerSupabase.mockReset().mockResolvedValue({
      from: vi.fn((table: string) => {
        const query = {
          select: vi.fn(() => query),
          eq: vi.fn(() => query),
          update: vi.fn(() => query),
          maybeSingle: vi.fn(async () => ({ data: table === "uploads" ? upload : null, error: null })),
          then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ error: null })); },
        };
        return query;
      }),
    });
  });

  it("Claude가 응답 뒤 실패해도 매핑 토큰을 기록하고 매핑 없이 계속한다", async () => {
    const usage = { model: "m", inputTokens: 11, outputTokens: 5 };
    proposeMapping.mockRejectedValueOnce(new AiCallError(usage));
    const result = await analyzeUpload("user-1", uploadId);
    expect(result.mapping).toBeNull();
    expect(vi.mocked(recordAiUsage).mock.calls).toEqual([["user-1", "mapping", usage]]);
  });
});

describe("createUpload", () => {
  const insert = vi.fn();
  beforeEach(() => {
    insert.mockReset();
    uploadsCreate.mockReset().mockResolvedValue("created");
    createUploadUrl.mockReset().mockResolvedValue("https://upload.example/signed");
    createServerSupabase.mockReset().mockResolvedValue({
      from: vi.fn(() => {
        const query = { select: vi.fn(() => query), eq: vi.fn(() => query), neq: vi.fn(() => query), insert, maybeSingle: vi.fn(async () => ({ data: null, error: null })) };
        return query;
      }),
    });
  });

  it("행은 사용자 client가 아니라 서버(adminUploads.create)가 만든다", async () => {
    const result = await createUpload("user-1", { filename: "card.csv", size: 10, sha256: "a".repeat(64) });
    expect(insert).not.toHaveBeenCalled();
    expect(uploadsCreate).toHaveBeenCalledWith({ userId: "user-1", uploadId: result.uploadId, filename: "card.csv", sha256: "a".repeat(64), byteSize: 10 });
    expect(result.uploadUrl).toBe("https://upload.example/signed");
  });

  it("같은 파일이 동시에 만들어지면 DUPLICATE_FILE", async () => {
    uploadsCreate.mockResolvedValueOnce("duplicate");
    await expect(createUpload("user-1", { filename: "card.csv", size: 10, sha256: "a".repeat(64) })).rejects.toMatchObject({ code: "DUPLICATE_FILE" });
    expect(createUploadUrl).not.toHaveBeenCalled();
  });
});
