import { beforeEach, describe, expect, it } from "vitest";

import { chatStorageKey, clearChatStorage, pruneChatStorage } from "./chat-storage";

describe("chat storage", () => {
  beforeEach(() => sessionStorage.clear());

  it("사용자마다 다른 키를 쓴다", () => {
    expect(chatStorageKey("a")).not.toBe(chatStorageKey("b"));
  });

  it("clearChatStorage는 모든 사용자의 채팅 기록과 예전 키를 지우고 다른 값은 남긴다", () => {
    sessionStorage.setItem(chatStorageKey("a"), "[]");
    sessionStorage.setItem(chatStorageKey("b"), "[]");
    sessionStorage.setItem("finsight.chat.v1", "[]");
    sessionStorage.setItem("other", "keep");
    clearChatStorage();
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.getItem("other")).toBe("keep");
  });

  it("pruneChatStorage는 지금 사용자의 기록만 남긴다", () => {
    sessionStorage.setItem(chatStorageKey("a"), "[1]");
    sessionStorage.setItem(chatStorageKey("b"), "[2]");
    sessionStorage.setItem("finsight.chat.v1", "[3]");
    pruneChatStorage("b");
    expect(sessionStorage.getItem(chatStorageKey("a"))).toBeNull();
    expect(sessionStorage.getItem("finsight.chat.v1")).toBeNull();
    expect(sessionStorage.getItem(chatStorageKey("b"))).toBe("[2]");
  });
});
