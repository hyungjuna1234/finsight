import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ user: vi.fn(), consent: vi.fn(), pro: vi.fn(), sb: vi.fn(), rows: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireUser: m.user, requireConsent: m.consent, requirePro: m.pro }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: m.sb }));
vi.mock("@/server/tx-rows", () => ({ loadTxViews: m.rows }));
import { AppError } from "@/lib/domain/errors";
import { toKRW } from "@/lib/domain/money";
import { getRecurring } from "./recurring";
import { makeTx } from "@/test/tx-factory";

beforeEach(() => { vi.clearAllMocks(); vi.setSystemTime(new Date("2026-09-30T12:00:00+09:00")); m.user.mockResolvedValue({ id: "u1" }); m.sb.mockResolvedValue({}); m.pro.mockResolvedValue(undefined); m.rows.mockResolvedValue(["2026-07-01", "2026-08-01", "2026-09-01"].map((occurredOn) => makeTx({ occurredOn, merchantRaw: "비밀상점", merchantKey: "secret", amountKrw: toKRW(10000) }))); });
it("Free 결과에는 요약만 있고 items 키가 없다", async () => { m.pro.mockRejectedValue(new AppError("PRO_REQUIRED")); const result = await getRecurring(); expect(result).toEqual({ state: "locked", summary: { count: 1, monthlyTotal: 10000 } }); expect(result).not.toHaveProperty("items"); });
it("Pro 결과에는 상세와 기준일이 있다", async () => { await expect(getRecurring()).resolves.toMatchObject({ state: "ready", asOf: "2026-09-30", summary: { count: 1 }, items: [{ merchantKey: "secret" }] }); });
