import { beforeEach, describe, expect, it, vi } from "vitest";
import { MODELS } from "./models";

const toolRunner = vi.fn();
vi.mock("@/services/claude/client", () => ({ getClaude: () => ({ beta: { messages: { toolRunner } } }) }));
import { CHAT_REFUSAL_TEXT, chat } from "./chat";

const message = (stop_reason: string, text = "답변") => ({ stop_reason, content: text ? [{ type: "text", text }] : [], usage: { input_tokens: 2, output_tokens: 3 } });
const iterable = (...messages: unknown[]) => ({ async *[Symbol.asyncIterator]() { yield* messages; } });
const input = { history: [], message: "질문", tools: [], today: "2026-09-27" as never };

describe("chat", () => {
  beforeEach(() => toolRunner.mockReset());
  it("uses Sonnet low effort, six iterations, date prompt and a signal", async () => {
    toolRunner.mockReturnValue(iterable(message("end_turn")));
    await expect(chat(input)).resolves.toMatchObject({ text: "답변", usage: { model: MODELS.chat, inputTokens: 2, outputTokens: 3 } });
    expect(toolRunner).toHaveBeenCalledWith(expect.objectContaining({ model: MODELS.chat, max_iterations: 6, output_config: { effort: "low" }, system: expect.stringContaining("2026-09-27") }), { signal: expect.any(AbortSignal) });
  });
  it("sums usage from every iteration and uses the last message", async () => {
    toolRunner.mockReturnValue(iterable(message("tool_use", ""), message("end_turn", "최종")));
    await expect(chat(input)).resolves.toMatchObject({ text: "최종", usage: { inputTokens: 4, outputTokens: 6 } });
  });
  it("maps refusal to the fixed response", async () => {
    toolRunner.mockReturnValue(iterable(message("refusal", "거절")));
    await expect(chat(input)).resolves.toMatchObject({ text: CHAT_REFUSAL_TEXT });
  });
  it.each(["max_tokens", "tool_use"])("rejects terminal %s", async (reason) => {
    toolRunner.mockReturnValue(iterable(message(reason, reason === "tool_use" ? "" : "잘림")));
    await expect(chat(input)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  });
  it("rejects empty text and SDK errors", async () => {
    toolRunner.mockReturnValueOnce(iterable(message("end_turn", "")));
    await expect(chat(input)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
    toolRunner.mockImplementationOnce(() => { throw new Error("network"); });
    await expect(chat(input)).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  });
});
