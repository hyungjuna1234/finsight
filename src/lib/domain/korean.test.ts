import { describe, expect, it } from "vitest";
import { withTopic } from "./korean";

describe("withTopic", () => {
  it.each([
    ["카페·간식", "카페·간식은"],
    ["식비", "식비는"],
    ["교통", "교통은"],
  ])("adds the correct Korean topic particle to %s", (word, expected) => {
    expect(withTopic(word)).toBe(expected);
  });

  it.each(["Pro", "", "카페!"])("uses 는 when the final character is not Hangul: %s", (word) => {
    expect(withTopic(word)).toBe(`${word}는`);
  });
});
