import { describe, expect, it } from "vitest";
import { compareMonths } from "@/lib/analytics/compare";
import { insightHasNumbers } from "@/lib/analytics/insight-metrics";
import { summarizeMonth } from "@/lib/analytics/month";
import { detectRecurring, recurringSummary } from "@/lib/analytics/recurring";
import { DEMO_MONTHS, DEMO_TODAY, DEMO_TRANSACTIONS } from "./fixtures";
import { getLandingShowcase } from "./landing";

describe("getLandingShowcase", () => {
  it("builds normalized category bars and a matching top category", () => {
    const showcase = getLandingShowcase();

    expect(showcase.categoryBars.reduce((sum, item) => sum + item.share, 0)).toBe(100);
    expect(Math.max(...showcase.categoryBars.map(({ width }) => width))).toBe(100);
    expect(showcase.topCategory).toEqual({
      category: showcase.categoryBars[0]?.category,
      amount: showcase.categoryBars[0]?.amount,
      share: showcase.categoryBars[0]?.share,
    });
  });

  it("selects five chronological sheet rows with distinct categories from the showcase month", () => {
    const showcase = getLandingShowcase();

    expect(showcase.sheetRows).toHaveLength(5);
    expect(new Set(showcase.sheetRows.map(({ category }) => category)).size).toBe(5);
    expect(showcase.sheetRows.every(({ date }) => `${showcase.month}-${date.replace(".", "-")}`.startsWith(showcase.month))).toBe(true);
    expect(showcase.sheetRows.map(({ date }) => date)).toEqual([...showcase.sheetRows.map(({ date }) => date)].sort());
  });

  it("uses the first eligible increase from compareMonths", () => {
    const showcase = getLandingShowcase();
    const current = summarizeMonth([...DEMO_TRANSACTIONS], DEMO_MONTHS[2]);
    const previous = summarizeMonth([...DEMO_TRANSACTIONS], DEMO_MONTHS[1]);
    const expected = compareMonths(current, previous).topIncreases.find((item) => item.diff > 0 && item.previous > 0);

    expect(showcase.increase).not.toBeNull();
    expect(showcase.increase).toMatchObject({
      category: expected?.category,
      previous: expected?.previous,
      current: expected?.current,
    });
  });

  it("aggregates daily totals from Monday through Sunday", () => {
    const showcase = getLandingShowcase();
    const summary = summarizeMonth([...DEMO_TRANSACTIONS], DEMO_MONTHS[2]);

    expect(showcase.weekend.days.map(({ label }) => label)).toEqual(["월", "화", "수", "목", "금", "토", "일"]);
    expect(showcase.weekend.days.map(({ weekend }) => weekend)).toEqual([false, false, false, false, false, true, true]);
    expect(showcase.weekend.days.reduce((sum, day) => sum + day.amount, 0)).toBe(
      summary.daily.reduce((sum, day) => sum + day.amount, 0),
    );
  });

  it("uses the shared recurring calculation", () => {
    const showcase = getLandingShowcase();
    const expected = recurringSummary(detectRecurring([...DEMO_TRANSACTIONS], DEMO_TODAY));

    expect(showcase.recurring.monthlyTotal).toBe(expected.monthlyTotal);
    expect(showcase.recurring.yearlyTotal).toBe(expected.monthlyTotal * 12);
  });

  it("keeps report copy free of numbers", () => {
    expect(insightHasNumbers(getLandingShowcase().report.content)).toBe(false);
  });

  it("returns the same result on repeated calls", () => {
    expect(getLandingShowcase()).toEqual(getLandingShowcase());
  });
});
