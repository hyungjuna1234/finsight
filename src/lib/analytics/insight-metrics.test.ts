import { describe, expect, it } from "vitest";
import { toKRW } from "@/lib/domain/money";
import type { MonthSummary } from "./month";
import { buildInsightMetrics, containsNumber, insightHasNumbers, InsightContentSchema } from "./insight-metrics";

const summary: MonthSummary = { month: "2026-09" as never, spend: toKRW(100000), refund: toKRW(10000), net: 90000, count: 3, pendingCount: 1, byCategory: [{ category: "식비", amount: toKRW(60000), count: 2 }], topMerchants: [{ merchantKey: "secret-key", label: "비밀가맹점", amount: toKRW(60000), count: 2 }], daily: [{ date: "2026-09-05" as never, amount: toKRW(60000) }, { date: "2026-09-07" as never, amount: toKRW(40000) }] };

describe("insight metrics", () => {
  it("builds aggregate-only metrics and UTC-based weekend share", () => {
    const result = buildInsightMetrics(summary, null, [{ merchantKey: "subscription-secret", label: "비밀구독", avgAmount: toKRW(10000), lastDate: "2026-09-01" as never, occurrences: 3, monthlyEstimate: toKRW(10000), nextExpectedDate: "2026-10-01" as never }]);
    expect(result.weekendShare).toBe(0.6);
    expect(result.recurring).toEqual({ count: 1, monthlyTotal: 10000 });
    expect(JSON.stringify(result)).not.toMatch(/비밀|secret/);
  });
  it("builds previous deltas and validates content", () => {
    const previous = { ...summary, month: "2026-08" as never, net: 50000, byCategory: [{ category: "식비" as const, amount: toKRW(30000), count: 1 }] };
    expect(buildInsightMetrics(summary, previous, []).previous).toMatchObject({ month: "2026-08", netRate: 0.8, increases: [{ category: "식비", diff: 30000 }] });
    expect(InsightContentSchema.parse({ headline: "좋아요", points: ["요점"], tips: [] })).toBeTruthy();
  });
  it("detects ASCII and full-width numbers everywhere", () => {
    expect(containsNumber("숫자 1")).toBe(true); expect(containsNumber("숫자 １")).toBe(true); expect(containsNumber("없음")).toBe(false);
    expect(insightHasNumbers({ headline: "제목", points: ["요점"], tips: ["팁 2"] })).toBe(true);
  });
});
