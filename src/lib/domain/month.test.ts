import { describe, expect, it } from "vitest";

import { addDays, daysBetween, formatMonthLabel, formatPeriodLabel, isIsoDate, isYearMonth, kstToday, monthRange, monthsBetween, nextMonth, prevMonth, toYearMonth } from "./month";
import type { IsoDate, YearMonth } from "./types";

const iso = (value: string) => value as IsoDate;
const ym = (value: string) => value as YearMonth;

describe("KST date helpers", () => {
  it("UTC 시각을 KST 날짜와 월로 변환한다", () => {
    const now = new Date("2026-08-31T15:30:00.000Z");
    expect(kstToday(now)).toBe("2026-09-01");
    expect(toYearMonth(now)).toBe("2026-09");
  });

  it("IsoDate는 문자열에 적힌 월을 반환한다", () => {
    expect(toYearMonth(iso("2026-02-28"))).toBe("2026-02");
  });

  it.each([["2026-02", true], ["2026-13", false], ["2026-2", false], ["abcd-ef", false]])(
    "isYearMonth(%s)는 %s다",
    (value, expected) => expect(isYearMonth(value)).toBe(expected),
  );

  it.each([["2024-02-29", true], ["2026-02-29", false], ["2026-02-30", false], ["2026-2-01", false]])(
    "isIsoDate(%s)는 %s다",
    (value, expected) => expect(isIsoDate(value)).toBe(expected),
  );

  it("윤년과 평년의 월 범위를 계산한다", () => {
    expect(monthRange(ym("2024-02"))).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthRange(ym("2026-02"))).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("연도 경계의 이전·다음 월을 계산한다", () => {
    expect(prevMonth(ym("2026-01"))).toBe("2025-12");
    expect(nextMonth(ym("2026-12"))).toBe("2027-01");
  });

  it("양끝을 포함한 월 목록을 만들고 역범위는 비운다", () => {
    expect(monthsBetween(ym("2025-11"), ym("2026-02"))).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsBetween(ym("2026-02"), ym("2026-01"))).toEqual([]);
  });

  it.each([
    ["2026-09-01", "2026-09-30", "9월"],
    ["2026-07-01", "2026-09-30", "7~9월"],
    ["2025-12-01", "2026-01-31", "2025년 12월~2026년 1월"],
  ])("%s~%s 기간을 %s로 표시한다", (from, to, expected) => {
    expect(formatPeriodLabel(iso(from), iso(to))).toBe(expected);
  });

  it.each([
    ["2026-01-31", 1, "2026-02-01"],
    ["2024-02-28", 1, "2024-02-29"],
    ["2024-02-29", 1, "2024-03-01"],
    ["2026-01-01", -1, "2025-12-31"],
  ])("%s에 %i일을 더하면 %s다", (date, days, expected) => {
    expect(addDays(iso(date), days)).toBe(expected);
  });

  it.each([
    ["2026-01-31", "2026-02-01", 1],
    ["2024-02-28", "2024-03-01", 2],
    ["2026-02-01", "2026-01-31", -1],
  ])("%s부터 %s까지 차이는 %i일이다", (from, to, expected) => {
    expect(daysBetween(iso(from), iso(to))).toBe(expected);
  });

  it.each([
    ["2026-09", undefined, "2026년 9월"],
    ["2026-09", "long", "2026년 9월"],
    ["2026-09", "short", "9월"],
  ] as const)("%s의 %s 레이블은 %s다", (month, style, expected) => {
    expect(formatMonthLabel(ym(month), style)).toBe(expected);
  });
});
