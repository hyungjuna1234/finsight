import { describe, expect, it } from "vitest";

import { maskDigits, maskSamples } from "./mask";

describe("maskDigits", () => {
  it.each([
    "1234-5678-9012-3456",
    "1234-****-****-5678",
    "010-1234-5678",
    "01012345678",
    "900101-1234567",
    "110-123-456789",
    "123-45-67890",
  ])("masks long digit tokens: %s", (input) => expect(maskDigits(input)).toBe("#"));

  it.each(["1,234,567", "2026.09.01 12:34", "12.99"])("preserves safe numeric value: %s", (input) => {
    expect(maskDigits(input)).toBe(input);
  });
});

describe("maskSamples", () => {
  it("keeps recognized values and masks free text and unknown headers", () => {
    expect(maskSamples(
      ["이용일자", "가맹점명", "고객 이름"],
      [["2026.09.01 12:34", "스타벅스 강남점", "미매입"], ["", "USD", "1,234,567"]],
    )).toEqual({
      headers: ["이용일자", "가맹점명", "고***(5자)"],
      samples: [["2026.09.01 12:34", "스***(8자)", "미매입"], ["", "USD", "1,234,567"]],
    });
  });
});
