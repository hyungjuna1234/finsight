import { beforeEach, describe, expect, it, vi } from "vitest";
import { MODELS } from "./models";

const parse = vi.fn();
vi.mock("@/services/claude/client", () => ({ getClaude: () => ({ messages: { parse } }) }));
import { writeInsight } from "./insight";

const metrics = { month: "2026-09", net: 1, spend: 1, refund: 0, count: 1, pendingCount: 0, categories: [], weekendShare: 0, previous: null, recurring: { count: 0, monthlyTotal: 0 } } as never;
const response = (headline: string, stop_reason = "end_turn") => ({ stop_reason, parsed_output: { headline, points: ["요점이에요"], tips: [] }, usage: { input_tokens: 2, output_tokens: 3 } });

describe("writeInsight", () => {
  beforeEach(() => parse.mockReset());
  it("uses the insight model, medium effort and timeout", async () => {
    parse.mockResolvedValue(response("차분한 달이에요"));
    await expect(writeInsight(metrics)).resolves.toMatchObject({ usage: { model: MODELS.insight, inputTokens: 2, outputTokens: 3 } });
    expect(parse).toHaveBeenCalledWith(expect.objectContaining({ model: MODELS.insight, output_config: expect.objectContaining({ effort: "medium" }) }), { timeout: 60000 });
  });
  it("retries once without numbers and combines usage", async () => {
    parse.mockResolvedValueOnce(response("지출 1건이에요")).mockResolvedValueOnce(response("지출이 있어요"));
    await expect(writeInsight(metrics)).resolves.toMatchObject({ usage: { inputTokens: 4, outputTokens: 6 } });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[1]?.[0].messages[0].content).toContain("숫자 없이 다시 써 주세요");
  });
  it.each([
    ["numbers", [response("1"), response("２")]],
    ["refusal", [response("거절", "refusal")]],
    ["null", [{ ...response("x"), parsed_output: null }]],
  ])("maps %s failures", async (_name, values) => {
    values.forEach((value) => parse.mockResolvedValueOnce(value));
    await expect(writeInsight(metrics)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  });
  it("maps SDK failures", async () => { parse.mockImplementationOnce(async () => { throw new Error("network"); }); await expect(writeInsight(metrics)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" }); });
});
