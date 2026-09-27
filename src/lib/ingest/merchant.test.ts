import { describe, expect, it } from "vitest";

import { normalizeMerchant } from "./merchant";

describe("normalizeMerchant", () => {
  it.each([
    ["KCP-네이버페이 스타벅스 강남점", "스타벅스 강남점"],
    ["NICE-(주) 가상상점", "가상상점"],
    ["KSNET 카카오페이_가상마트", "가상마트"],
    ["㈜PAYCO 가상서점", "가상서점"],
    ["주식회사 토스페이 가상식당", "가상식당"],
    ["NAVERPAY가상카페", "가상카페"],
  ])("removes repeated payment and corporate prefixes", (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected);
  });

  it("normalizes compatibility characters, casing, whitespace and edge punctuation", () => {
    expect(normalizeMerchant("  ·Ａｂｃ   Store！ ")).toBe("ABC STORE");
  });

  it("keeps branch suffixes and limits the result to 100 characters", () => {
    expect(normalizeMerchant("스타벅스 강남점")).toBe("스타벅스 강남점");
    expect(normalizeMerchant("가".repeat(101))).toHaveLength(100);
  });

  it("uses a safe label when normalization empties the value", () => {
    expect(normalizeMerchant("... -- ")).toBe("알 수 없음");
  });
});
