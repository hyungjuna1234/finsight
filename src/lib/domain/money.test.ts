import { describe, expect, it } from "vitest";

import { formatKRW, formatKRWShort, formatSignedKRW, sumKRW, toKRW } from "./money";

describe("money", () => {
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("유효하지 않은 금액 %s를 거부한다", (value) => {
    expect(() => toKRW(value)).toThrow(RangeError);
  });

  it("정수 원화 금액을 만들고 표시한다", () => {
    expect(formatKRW(toKRW(1_234_000))).toBe("₩1,234,000");
    expect(formatKRW(toKRW(0))).toBe("₩0");
  });

  it.each([
    [0, "0"],
    [9_999, "1만"],
    [120_000, "12만"],
    [12_340_000, "1,234만"],
  ])("%i원을 차트 축 형식 %s로 표시한다", (value, expected) => {
    expect(formatKRWShort(toKRW(value))).toBe(expected);
  });

  it("원화 금액을 합산한다", () => {
    expect(sumKRW([toKRW(1_000), toKRW(2_500)])).toBe(3_500);
    expect(sumKRW([])).toBe(0);
  });

  it.each([
    [-12_000, undefined, "−₩12,000"],
    [12_000, undefined, "₩12,000"],
    [12_000, { plus: true }, "+₩12,000"],
    [0, { plus: true }, "₩0"],
  ] as const)("부호 있는 %i원을 %s 옵션으로 표시한다", (value, options, expected) => {
    expect(formatSignedKRW(value, options)).toBe(expected);
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY])("부호 있는 비정수 금액 %s를 거부한다", (value) => {
    expect(() => formatSignedKRW(value)).toThrow(RangeError);
  });
});
