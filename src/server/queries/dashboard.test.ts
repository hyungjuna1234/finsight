import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), requireConsent: vi.fn(), createSb: vi.fn(), span: vi.fn(), rows: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser, requireConsent: mocks.requireConsent }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: mocks.createSb }));
vi.mock("@/server/tx-rows", () => ({ loadDataMonthSpan: mocks.span, loadTxViews: mocks.rows }));
import { AppError } from "@/lib/domain/errors";
import { getDashboard, getHasTransactions } from "./dashboard";

beforeEach(() => { vi.clearAllMocks(); vi.setSystemTime(new Date("2026-10-03T00:00:00+09:00")); mocks.requireUser.mockResolvedValue({ id: "u1", email: null }); mocks.createSb.mockResolvedValue({}); mocks.rows.mockResolvedValue([]); });

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
