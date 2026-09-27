import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), consent: vi.fn(), pro: vi.fn(), sb: vi.fn(), span: vi.fn(), rows: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireUser: m.user, requireConsent: m.consent, requirePro: m.pro }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: m.sb }));
vi.mock("@/server/tx-rows", () => ({ loadDataMonthSpan: m.span, loadTxViews: m.rows }));
import { AppError } from "@/lib/domain/errors";
import { getTrends } from "./trends";

beforeEach(() => { vi.clearAllMocks(); m.user.mockResolvedValue({ id: "u1" }); m.sb.mockResolvedValue({}); m.pro.mockResolvedValue(undefined); m.rows.mockResolvedValue([]); });
describe("getTrends", () => {
  it("데이터가 없으면 empty", async () => { m.span.mockResolvedValue(null); await expect(getTrends()).resolves.toEqual({ state: "empty" }); });
  it("Free는 잠금 상태만 반환하고 거래를 읽지 않는다", async () => { m.span.mockResolvedValue({ first: "2026-07", last: "2026-09" }); m.pro.mockRejectedValue(new AppError("PRO_REQUIRED")); await expect(getTrends()).resolves.toEqual({ state: "locked", monthsWithData: 3 }); expect(m.rows).not.toHaveBeenCalled(); });
  it("Pro는 최근 최대 12개월의 추이를 반환한다", async () => { m.span.mockResolvedValue({ first: "2025-01", last: "2026-09" }); await expect(getTrends()).resolves.toMatchObject({ state: "ready", months: ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"] }); expect(m.rows).toHaveBeenCalledOnce(); });
  it("권한 외 오류는 전파한다", async () => { m.span.mockResolvedValue({ first: "2026-09", last: "2026-09" }); m.pro.mockRejectedValue(new AppError("INTERNAL")); await expect(getTrends()).rejects.toMatchObject({ code: "INTERNAL" }); });
});
