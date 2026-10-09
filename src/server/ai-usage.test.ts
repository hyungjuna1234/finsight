import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordAiUsage } = vi.hoisted(() => ({ recordAiUsage: vi.fn() }));
vi.mock("@/server/limits", () => ({ recordAiUsage }));

import { AppError } from "@/lib/domain/errors";
import { AiCallError } from "@/services/claude/models";

import { recordFailedAiCall, withAiUsage } from "./ai-usage";

const usage = { model: "m", inputTokens: 5, outputTokens: 7 };

describe("withAiUsage", () => {
  beforeEach(() => {
    recordAiUsage.mockReset();
    recordAiUsage.mockResolvedValue(undefined);
  });

  it("성공한 호출의 usage를 기록하고 결과를 돌려준다", async () => {
    await expect(withAiUsage("u", "chat", async () => ({ text: "답", usage }))).resolves.toEqual({ text: "답", usage });
    expect(recordAiUsage.mock.calls).toEqual([["u", "chat", usage]]);
  });

  it("응답을 받은 뒤 실패해도(AiCallError) 쓴 토큰을 기록하고 같은 오류를 다시 던진다", async () => {
    const failure = new AiCallError(usage);
    await expect(withAiUsage("u", "insight", async () => { throw failure; })).rejects.toBe(failure);
    expect(recordAiUsage.mock.calls).toEqual([["u", "insight", usage]]);
  });

  it("Claude 호출 오류가 아니면 기록하지 않는다", async () => {
    await expect(withAiUsage("u", "chat", async () => { throw new AppError("INTERNAL"); })).rejects.toMatchObject({ code: "INTERNAL" });
    expect(recordAiUsage).not.toHaveBeenCalled();
  });
});

describe("recordFailedAiCall", () => {
  beforeEach(() => recordAiUsage.mockReset());

  it("AiCallError일 때만 그 usage를 기록한다", async () => {
    await recordFailedAiCall("u", "classify", new AiCallError(usage));
    await recordFailedAiCall("u", "classify", new Error("bug"));
    expect(recordAiUsage.mock.calls).toEqual([["u", "classify", usage]]);
  });
});
