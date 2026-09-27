import { expect, it } from "vitest";
import { CHAT_EXAMPLES } from "./chat";
it("채팅 예시 질문을 제공한다", () => { expect(CHAT_EXAMPLES).toHaveLength(4); expect(CHAT_EXAMPLES.every(Boolean)).toBe(true); });
