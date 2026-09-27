import { buildDashboardModel, resolveMonth, type DashboardModel } from "@/lib/analytics/dashboard";
import type { InsightContent } from "@/lib/analytics/insight-metrics";
import { compareMonths, monthlyTrend, type MonthDelta, type TrendPoint } from "@/lib/analytics/compare";
import { summarizeMonth } from "@/lib/analytics/month";
import { detectRecurring, recurringSummary, type RecurringItem } from "@/lib/analytics/recurring";
import type { Category } from "@/lib/domain/categories";
import { toKRW } from "@/lib/domain/money";
import type { IsoDate, KRW, TxStatus, TxView, YearMonth } from "@/lib/domain/types";
import { normalizeMerchant } from "@/lib/ingest/merchant";

export const DEMO_TODAY = "2026-09-30" as IsoDate;
export const DEMO_MONTHS: readonly [YearMonth, YearMonth, YearMonth] = [
  "2026-07" as YearMonth,
  "2026-08" as YearMonth,
  "2026-09" as YearMonth,
];

export const DEMO_INSIGHT: InsightContent = {
  headline: "외식 지출이 늘고 작은 간식 지출은 줄었어요",
  points: ["식사 관련 지출이 지난달보다 눈에 띄게 늘었어요.", "카페 방문은 줄어 생활비 흐름이 한결 단순해졌어요."],
  tips: ["배달과 외식을 함께 살펴보면 줄이기 쉬운 지출을 찾을 수 있어요.", "정기결제는 실제 사용 여부를 기준으로 가볍게 점검해 보세요."],
};

type MerchantPattern = { name: string; category: Category; min: number; range: number };

const DAILY_PATTERNS: readonly MerchantPattern[] = [
  { name: "골목식당", category: "식비", min: 10_000, range: 13_000 },
  { name: "한끼배달", category: "식비", min: 16_000, range: 15_000 },
  { name: "나무카페", category: "카페·간식", min: 4_000, range: 4_500 },
  { name: "동네편의점", category: "마트·편의점", min: 3_000, range: 12_000 },
  { name: "우리마트", category: "마트·편의점", min: 18_000, range: 45_000 },
  { name: "시내버스", category: "교통", min: 1_400, range: 900 },
  { name: "생활상점", category: "쇼핑", min: 12_000, range: 55_000 },
  { name: "동네약국", category: "의료·건강", min: 6_000, range: 18_000 },
] as const;

const RECURRING = [
  { name: "웨이브", category: "구독·디지털", amount: 10_900 },
  { name: "멜론", category: "구독·디지털", amount: 7_900 },
  { name: "푸른통신", category: "주거·통신", amount: 42_000 },
  { name: "바른헬스", category: "의료·건강", amount: 55_000 },
  { name: "구름저장소", category: "구독·디지털", amount: 3_300 },
] as const satisfies readonly { name: string; category: Category; amount: number }[];

let nextId = 1;

function tx(input: Omit<TxView, "id" | "merchantKey">): TxView {
  return { ...input, id: `demo-${String(nextId++).padStart(4, "0")}`, merchantKey: normalizeMerchant(input.merchantRaw) };
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function monthTransactions(month: YearMonth, monthIndex: number): TxView[] {
  const random = seeded(7_217 + monthIndex * 101);
  const result: TxView[] = [];
  for (let index = 0; index < 60; index += 1) {
    let pattern = DAILY_PATTERNS[index % DAILY_PATTERNS.length]!;
    if (monthIndex === 2 && pattern.category === "카페·간식" && index >= 35) pattern = DAILY_PATTERNS[0]!;
    const day = String(1 + (index * 7 + Math.floor(random() * 5)) % 28).padStart(2, "0");
    const branch = ["서교점", "성수점", "연남점"][monthIndex]!;
    const foodBoost = monthIndex === 2 && pattern.category === "식비" ? 8_000 : 0;
    const cafeAdjustment = monthIndex === 2 && pattern.category === "카페·간식" ? -1_000 : 0;
    let status: TxStatus = "posted";
    let kind: TxView["kind"] = "spend";
    let installmentMonths: number | null = null;
    let foreignAmount: number | null = null;
    let foreignCurrency: string | null = null;
    let merchantRaw = `${pattern.name} ${branch}`;
    let amount = Math.max(1_000, pattern.min + Math.floor(random() * pattern.range / 100) * 100 + foodBoost + cafeAdjustment);

    if (monthIndex === 0 && index === 9) status = "cancelled";
    if (monthIndex === 1 && index === 17) { kind = "refund"; amount = 28_000; }
    if (monthIndex === 1 && index === 31) { installmentMonths = 3; merchantRaw = "온라인가구점"; amount = 189_000; }
    if (monthIndex === 2 && index === 47) {
      status = "pending"; merchantRaw = "GLOBAL BOOKS"; amount = 36_500; foreignAmount = 25; foreignCurrency = "USD";
    }

    result.push(tx({
      cardId: index % 3 === 0 ? "demo-card-2" : "demo-card-1",
      occurredOn: `${month}-${day}` as IsoDate,
      merchantRaw,
      amountKrw: toKRW(amount),
      kind,
      status,
      category: merchantRaw === "온라인가구점" ? "쇼핑" : merchantRaw === "GLOBAL BOOKS" ? "교육" : pattern.category,
      categorySource: status === "pending" ? "pending" : "ai",
      installmentMonths,
      foreignAmount,
      foreignCurrency,
    }));
  }
  const recurringDay = ["05", "05", "04"][monthIndex]!;
  for (const item of RECURRING) {
    result.push(tx({
      cardId: item.name === "푸른통신" ? "demo-card-2" : "demo-card-1",
      occurredOn: `${month}-${recurringDay}` as IsoDate,
      merchantRaw: item.name,
      amountKrw: toKRW(item.amount),
      kind: "spend",
      status: "posted",
      category: item.category,
      categorySource: "history",
      installmentMonths: null,
      foreignAmount: null,
      foreignCurrency: null,
    }));
  }
  return result;
}

export const DEMO_TRANSACTIONS: readonly TxView[] = DEMO_MONTHS.flatMap(monthTransactions);

export function getDemoDashboard(month?: string | null): DashboardModel {
  const availableMonths = [...DEMO_MONTHS].reverse();
  return buildDashboardModel({ txs: [...DEMO_TRANSACTIONS], month: resolveMonth(month, availableMonths), availableMonths, today: DEMO_TODAY });
}

export function getDemoProPreview(): { recurring: RecurringItem[]; recurringTotal: { count: number; monthlyTotal: KRW }; trend: TrendPoint[]; delta: MonthDelta } {
  const recurring = detectRecurring([...DEMO_TRANSACTIONS], DEMO_TODAY);
  return {
    recurring,
    recurringTotal: recurringSummary(recurring),
    trend: monthlyTrend([...DEMO_TRANSACTIONS], [...DEMO_MONTHS]),
    delta: compareMonths(summarizeMonth([...DEMO_TRANSACTIONS], DEMO_MONTHS[2]), summarizeMonth([...DEMO_TRANSACTIONS], DEMO_MONTHS[1])),
  };
}
