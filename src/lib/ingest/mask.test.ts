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

  it.each([
    ["3333-01-1234567", "#"],
    ["123456-01-123456", "#"],
    ["1234-56-789012", "#"],
    ["30012345", "#"],
    ["０１０-１２３４-５６７８", "#"],
    ["송금 ０１０-１２３４-５６７８", "송금 #"],
    ["2024-01-15 1234567", "2024-01-15 #"],
    ["2024-01-15", "2024-01-15"],
    ["2024.01.15 13:45", "2024.01.15 13:45"],
    ["20240115", "20240115"],
  ])("narrows date protection for %s", (input, expected) => {
    expect(maskDigits(input)).toBe(expected);
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

  it("does not leave account digits in samples", () => {
    const result = maskSamples(["가맹점명"], [["3333-01-1234567"]]);

    expect(result.samples[0]?.[0]).not.toMatch(/3333|1234567/);
  });
});
