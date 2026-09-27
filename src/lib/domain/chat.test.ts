import { describe, expect, it } from "vitest";
import { CHAT_EXAMPLES } from "./chat";
it("채팅 예시 질문을 제공한다", () => { expect(CHAT_EXAMPLES).toHaveLength(4); expect(CHAT_EXAMPLES.every(Boolean)).toBe(true); });
import { ChatRequestSchema, normalizeHistory, type ChatTurn } from "./chat";

describe("ChatRequestSchema", () => {
  it("trims a valid message and rejects oversized input", () => {
    expect(ChatRequestSchema.parse({ history: [], message: "  질문  " }).message).toBe("질문");
    expect(ChatRequestSchema.safeParse({ history: [], message: "가".repeat(501) }).success).toBe(false);
  });

  it("limits history input to forty turns", () => {
    const history = Array.from({ length: 41 }, (_, index) => ({ role: index % 2 ? "assistant" : "user", content: "x" }));
    expect(ChatRequestSchema.safeParse({ history, message: "질문" }).success).toBe(false);
  });
});

describe("normalizeHistory", () => {
  it.each([
    ["removes blanks before removing a trailing user", [{ role: "user", content: " " }, { role: "user", content: "질문" }], []],
    ["removes leading assistants", [{ role: "assistant", content: "a" }, { role: "user", content: "u" }, { role: "assistant", content: "a2" }], [{ role: "user", content: "u" }, { role: "assistant", content: "a2" }]],
    ["removes a trailing user", [{ role: "user", content: "u" }, { role: "assistant", content: "a" }, { role: "user", content: "next" }], [{ role: "user", content: "u" }, { role: "assistant", content: "a" }]],
  ] satisfies [string, ChatTurn[], ChatTurn[]][])('%s', (_name, input, expected) => {
    expect(normalizeHistory(input)).toEqual(expected);
  });

  it("keeps the latest twenty turns and truncates by role", () => {
    const history = Array.from({ length: 22 }, (_, index): ChatTurn => ({ role: index % 2 ? "assistant" : "user", content: index === 2 ? "u".repeat(600) : index === 3 ? "a".repeat(4100) : String(index) }));
    const result = normalizeHistory(history);
    expect(result).toHaveLength(20);
    expect(result[0]?.content).toHaveLength(500);
    expect(result[1]?.content).toHaveLength(4000);
  });
});
