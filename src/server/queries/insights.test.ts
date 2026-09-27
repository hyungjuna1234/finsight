import { describe, expect, it, vi } from "vitest";
const order: string[] = [];
vi.mock("@/server/auth", () => ({ requireUser: async () => { order.push("user"); return { id: "u" }; }, requireConsent: async () => { order.push("consent"); }, getPlan: async () => ({ plan: "free", isPro: false, freeInsightAvailable: true }) }));
vi.mock("@/server/tx-rows", () => ({ loadDataMonthSpan: async () => null, loadTxViews: vi.fn() }));
vi.mock("@/services/supabase/server", () => ({ createServerSupabase: async () => ({}) }));
import { getInsightPage } from "./insights";
describe("getInsightPage", () => { it("returns empty after authentication and consent", async () => { await expect(getInsightPage()).resolves.toEqual({ state: "empty" }); expect(order).toEqual(["user", "consent"]); }); });
