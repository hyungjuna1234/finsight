import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), createSb: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: mocks.createSb }));
import { getSettings, getSubscriptionSummary } from "./settings";

beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue({ id: "u1" }); });

it("업로드와 카드를 필요한 표시 형태로 매핑한다", async () => {
  const uploadOrder = vi.fn().mockResolvedValue({ data: [{ id: "u2", filename: "b.csv", status: "done", created_at: "2026-09-02", period_from: "2026-07-01", period_to: "2026-09-30", counts: { inserted: 12 }, original_deleted_at: null, card_id: "c1" }, { id: "u1", filename: "a.csv", status: "failed", created_at: "2026-09-01", period_from: null, period_to: null, counts: { inserted: "12" }, original_deleted_at: "2026-09-03", card_id: null }], error: null });
  const cardOrder = vi.fn().mockResolvedValue({ data: [{ id: "c1", name: "신한" }], error: null });
  const from = vi.fn((table: string) => ({ select: vi.fn(() => ({ order: table === "uploads" ? uploadOrder : cardOrder })) }));
  mocks.createSb.mockResolvedValue({ from });
  await expect(getSettings()).resolves.toEqual({
    uploads: [
      { id: "u2", filename: "b.csv", status: "done", createdAt: "2026-09-02", periodFrom: "2026-07-01", periodTo: "2026-09-30", inserted: 12, cardName: "신한", originalDeleted: false },
      { id: "u1", filename: "a.csv", status: "failed", createdAt: "2026-09-01", periodFrom: null, periodTo: null, inserted: null, cardName: null, originalDeleted: true },
    ], cards: [{ id: "c1", name: "신한" }],
  });
  expect(mocks.requireUser).toHaveBeenCalledBefore(mocks.createSb);
  expect(uploadOrder).toHaveBeenCalledWith("created_at", { ascending: false });
});

it("returns an active subscription summary after requiring the user", async () => {
  const single = vi.fn().mockResolvedValue({ data: { plan: "pro", status: "past_due", period_end: "2026-10-26T00:00:00.000Z", cancel_at_period_end: true }, error: null });
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: single })) }));
  mocks.createSb.mockResolvedValue({ from: vi.fn(() => ({ select })) });
  await expect(getSubscriptionSummary(new Date("2026-10-27T00:00:00.000Z"))).resolves.toEqual({ plan: "pro", status: "past_due", periodEnd: "2026-10-26T00:00:00.000Z", active: true, cancelAtPeriodEnd: true });
  expect(select).toHaveBeenCalledWith("plan,status,period_end,cancel_at_period_end");
  expect(mocks.requireUser).toHaveBeenCalledBefore(mocks.createSb);
});

it("treats a missing entitlement row as Free without a scheduled cancellation", async () => {
  const single = vi.fn().mockResolvedValue({ data: null, error: null });
  mocks.createSb.mockResolvedValue({ from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: single })) })) })) });
  await expect(getSubscriptionSummary()).resolves.toEqual({ plan: "free", status: "none", periodEnd: null, active: false, cancelAtPeriodEnd: false });
});
