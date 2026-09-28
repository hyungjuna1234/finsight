import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireConsent: vi.fn(),
  getPlan: vi.fn(),
  createSb: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eqUser: vi.fn(),
  eqMonth: vi.fn(),
  span: vi.fn(),
  rows: vi.fn(),
  has: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser, requireConsent: mocks.requireConsent, getPlan: mocks.getPlan }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: mocks.createSb }));
vi.mock("@/server/tx-rows", () => ({ loadDataMonthSpan: mocks.span, loadTxViews: mocks.rows, hasTxInRange: mocks.has }));
import { AppError } from "@/lib/domain/errors";
import type { YearMonth } from "@/lib/domain/types";
import { getDashboard, getHasTransactions, getJourney, getProPanel } from "./dashboard";

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date("2026-10-03T00:00:00+09:00"));
  mocks.requireUser.mockResolvedValue({ id: "u1", email: null });
  mocks.createSb.mockResolvedValue({ from: mocks.from });
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eqUser });
  mocks.eqUser.mockReturnValue({ eq: mocks.eqMonth });
  mocks.eqMonth.mockResolvedValue({ count: 0, error: null });
  mocks.rows.mockResolvedValue([]);
  mocks.span.mockResolvedValue({ first: "2026-08", last: "2026-09" });
  mocks.has.mockResolvedValue(true);
  mocks.getPlan.mockResolvedValue({ plan: "free", isPro: false, freeInsightAvailable: true });
});

describe("dashboard queries", () => {
  it("인증 오류를 그대로 전파한다", async () => {
    mocks.requireUser.mockRejectedValue(new AppError("UNAUTHENTICATED"));
    await expect(getDashboard()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
  it("거래가 없으면 empty이며 존재 여부도 false다", async () => {
    mocks.span.mockResolvedValue(null);
    await expect(getDashboard()).resolves.toEqual({ state: "empty" });
    await expect(getHasTransactions()).resolves.toBe(false);
  });
  it.each(["2026-13", "abc"])("잘못된 월 %s은 최신 달로 대체하고 배너를 계산한다", async (requested) => {
    mocks.span.mockResolvedValue({ first: "2026-07", last: "2026-08" });
    const result = await getDashboard(requested);
    expect(result).toMatchObject({ state: "ready", month: "2026-08" });
    if (result.state === "ready") expect(result.uploadBannerMonth).toBeTruthy();
  });
});

describe("getProPanel", () => {
  it("Free는 전월 존재만 확인하고 잠긴 수치를 만들지 않는다", async () => {
    const result = await getProPanel("2026-09" as YearMonth);
    expect(result).toMatchObject({ kind: "free", comparisonLocked: { previousMonth: "2026-08" }, trendLocked: true });
    expect(mocks.has).toHaveBeenCalledOnce();
    expect(mocks.rows).toHaveBeenCalledOnce();
  });
  it("Pro는 정기결제와 이번 달·전월 데이터를 읽는다", async () => {
    mocks.getPlan.mockResolvedValue({ plan: "pro", isPro: true, freeInsightAvailable: false });
    const result = await getProPanel("2026-09" as YearMonth);
    expect(result.kind).toBe("pro");
    expect(mocks.rows).toHaveBeenCalledTimes(3);
    expect(mocks.has).not.toHaveBeenCalled();
  });
});

describe("getJourney", () => {
  const input = { month: "2026-09" as YearMonth, monthsWithData: 3, staleMonth: null };

  it("Free는 insights를 조회하지 않고 무료 리포트 사용 여부로 체크리스트를 만든다", async () => {
    await expect(getJourney(input)).resolves.toMatchObject({
      checklist: expect.arrayContaining([{ key: "first_insight", done: false }]),
      primary: "first_insight",
    });

    mocks.getPlan.mockResolvedValue({ plan: "free", isPro: false, freeInsightAvailable: false });
    await expect(getJourney(input)).resolves.toEqual({ checklist: null, primary: "pro_upgrade" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("Pro는 이번 달 리포트가 없으면 리포트 생성을 primary로 정한다", async () => {
    mocks.getPlan.mockResolvedValue({ plan: "pro", isPro: true, freeInsightAvailable: false });
    await expect(getJourney(input)).resolves.toEqual({ checklist: null, primary: "pro_insight" });
    expect(mocks.from).toHaveBeenCalledWith("insights");
    expect(mocks.select).toHaveBeenCalledWith("month", { count: "exact", head: true });
    expect(mocks.eqUser).toHaveBeenCalledWith("user_id", "u1");
    expect(mocks.eqMonth).toHaveBeenCalledWith("month", "2026-09");
  });

  it("Pro는 이번 달 리포트가 있으면 primary가 없다", async () => {
    mocks.getPlan.mockResolvedValue({ plan: "pro", isPro: true, freeInsightAvailable: false });
    mocks.eqMonth.mockResolvedValue({ count: 1, error: null });
    await expect(getJourney(input)).resolves.toEqual({ checklist: null, primary: null });
  });

  it("리포트 조회 오류는 상세 없이 INTERNAL로 바꾼다", async () => {
    mocks.getPlan.mockResolvedValue({ plan: "pro", isPro: true, freeInsightAvailable: false });
    mocks.eqMonth.mockResolvedValue({ count: null, error: new Error("database detail") });
    await expect(getJourney(input)).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("오래된 달이 있으면 플랜과 무관하게 업로드를 우선한다", async () => {
    await expect(getJourney({ ...input, staleMonth: "2026-10" as YearMonth })).resolves.toMatchObject({ primary: "stale_upload" });
  });

  it("인증 오류를 그대로 전파한다", async () => {
    mocks.requireUser.mockRejectedValue(new AppError("UNAUTHENTICATED"));
    await expect(getJourney(input)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
