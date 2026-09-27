import { describe, expect, it } from "vitest";
import { detectRecurring } from "@/lib/analytics/recurring";
import { summarizeMonth } from "@/lib/analytics/month";
import { isCategory } from "@/lib/domain/categories";
import { isIsoDate } from "@/lib/domain/month";
import { normalizeMerchant } from "@/lib/ingest/merchant";
import {
  DEMO_INSIGHT,
  DEMO_MONTHS,
  DEMO_TODAY,
  DEMO_TRANSACTIONS,
  getDemoDashboard,
  getDemoProPreview,
} from "./fixtures";

const recurringMerchants = ["웨이브", "멜론", "푸른통신", "바른헬스", "구름저장소"].map(normalizeMerchant);

describe("demo fixtures", () => {
  it("contains valid, unique transactions for all three demo months", () => {
    expect(new Set(DEMO_TRANSACTIONS.map(({ id }) => id)).size).toBe(DEMO_TRANSACTIONS.length);
    for (const tx of DEMO_TRANSACTIONS) {
      expect(isCategory(tx.category)).toBe(true);
      expect(isIsoDate(tx.occurredOn)).toBe(true);
      expect(Number.isInteger(tx.amountKrw)).toBe(true);
      expect(tx.amountKrw).toBeGreaterThanOrEqual(0);
      expect(DEMO_MONTHS).toContain(tx.occurredOn.slice(0, 7));
      expect(tx.merchantKey).toBe(normalizeMerchant(tx.merchantRaw));
    }
    for (const month of DEMO_MONTHS) {
      const summary = summarizeMonth([...DEMO_TRANSACTIONS], month);
      expect(summary.count).toBeGreaterThan(0);
      expect(summary.net).toBeGreaterThan(0);
      expect(DEMO_TRANSACTIONS.filter((tx) => tx.occurredOn.startsWith(month)).length).toBeGreaterThanOrEqual(60);
      expect(DEMO_TRANSACTIONS.filter((tx) => tx.occurredOn.startsWith(month)).length).toBeLessThanOrEqual(90);
    }
    expect(summarizeMonth([...DEMO_TRANSACTIONS], DEMO_MONTHS[2]).pendingCount).toBe(1);
  });

  it("finds all five recurring merchants", () => {
    const keys = detectRecurring([...DEMO_TRANSACTIONS], DEMO_TODAY).map(({ merchantKey }) => merchantKey);
    expect(keys).toEqual(expect.arrayContaining(recurringMerchants));
    expect(recurringMerchants).toHaveLength(5);
  });

  it("includes refund, cancellation, installment, and pending foreign examples", () => {
    expect(DEMO_TRANSACTIONS.some(({ kind }) => kind === "refund")).toBe(true);
    expect(DEMO_TRANSACTIONS.some(({ status }) => status === "cancelled")).toBe(true);
    expect(DEMO_TRANSACTIONS.some(({ installmentMonths }) => installmentMonths === 3)).toBe(true);
    expect(DEMO_TRANSACTIONS.some((tx) => tx.status === "pending" && tx.foreignAmount !== null && tx.foreignCurrency !== null)).toBe(true);
  });

  it("keeps the static insight free of digits", () => {
    expect([DEMO_INSIGHT.headline, ...DEMO_INSIGHT.points, ...DEMO_INSIGHT.tips].join(" ")).not.toMatch(/[0-9０-９]/);
  });
});

describe("demo models", () => {
  it("resolves requested and fallback months without an upload banner", () => {
    expect(getDemoDashboard("2026-08").month).toBe("2026-08");
    expect(getDemoDashboard("invalid").month).toBe("2026-09");
    expect(getDemoDashboard().uploadBannerMonth).toBeNull();
    expect(getDemoDashboard("2026-08")).toEqual(getDemoDashboard("2026-08"));
  });

  it("builds meaningful pro preview comparisons", () => {
    const preview = getDemoProPreview();
    expect(preview.recurring).toHaveLength(5);
    expect(preview.recurringTotal.count).toBe(5);
    expect(preview.trend).toHaveLength(3);
    expect(preview.delta.month).toBe("2026-09");
    const september = summarizeMonth([...DEMO_TRANSACTIONS], DEMO_MONTHS[2]);
    const august = summarizeMonth([...DEMO_TRANSACTIONS], DEMO_MONTHS[1]);
    expect(september.byCategory.find(({ category }) => category === "식비")!.amount).toBeGreaterThan(august.byCategory.find(({ category }) => category === "식비")!.amount);
    expect(september.byCategory.find(({ category }) => category === "카페·간식")!.amount).toBeLessThan(august.byCategory.find(({ category }) => category === "카페·간식")!.amount);
  });
});
