import { describe, expect, it } from "vitest";

import type { YearMonth } from "./types";
import { buildJourney } from "./journey";

const staleMonth = "2026-08" as YearMonth;

function input(overrides: Partial<Parameters<typeof buildJourney>[0]> = {}): Parameters<typeof buildJourney>[0] {
  return {
    isPro: false,
    monthsWithData: 0,
    freeInsightAvailable: true,
    staleMonth: null,
    hasInsightThisMonth: false,
    ...overrides,
  };
}

describe("buildJourney", () => {
  it.each([
    { months: 0, done: [true, false, false, false], progress: 0, primary: "first_upload" },
    { months: 1, done: [true, true, false, false], progress: 1, primary: "three_months" },
    { months: 2, done: [true, true, false, false], progress: 2, primary: "three_months" },
    { months: 3, done: [true, true, true, false], progress: 3, primary: "first_insight" },
    { months: 5, done: [true, true, true, false], progress: 3, primary: "first_insight" },
  ])("$months개월의 체크리스트 경계값을 계산한다", ({ months, done, progress, primary }) => {
    const journey = buildJourney(input({ monthsWithData: months }));
    expect(journey.checklist?.map((item) => item.done)).toEqual(done);
    expect(journey.checklist?.find((item) => item.key === "three_months")?.progress).toEqual({ now: progress, goal: 3 });
    expect(journey.primary).toBe(primary);
  });

  it("무료 리포트를 사용하면 마지막 항목이 완료되고 Pro 시작이 우선 행동이다", () => {
    expect(buildJourney(input({ monthsWithData: 3, freeInsightAvailable: false }))).toEqual({ checklist: null, primary: "pro_upgrade" });
  });

  it("Pro에는 체크리스트가 없고 이번 달 리포트가 다음 행동이다", () => {
    expect(buildJourney(input({ isPro: true }))).toEqual({ checklist: null, primary: "pro_insight" });
  });

  it("Pro가 이번 달 리포트를 이미 만들었으면 다음 행동이 없다", () => {
    expect(buildJourney(input({ isPro: true, hasInsightThisMonth: true }))).toEqual({ checklist: null, primary: null });
  });

  it("오래된 데이터 알림은 다른 모든 행동보다 우선한다", () => {
    expect(buildJourney(input({ isPro: true, staleMonth, hasInsightThisMonth: false })).primary).toBe("stale_upload");
    expect(buildJourney(input({ monthsWithData: 3, freeInsightAvailable: false, staleMonth })).primary).toBe("stale_upload");
  });
});
