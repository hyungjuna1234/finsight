import { beforeEach, describe, expect, it, vi } from "vitest";
const { confirmCheckout } = vi.hoisted(() => ({ confirmCheckout: vi.fn() }));
vi.mock("@/server/actions/billing", () => ({ confirmCheckout }));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: "user-1", email: null }) }));
import { POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/billing/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("POST /api/billing/confirm", () => {
  beforeEach(() => confirmCheckout.mockReset());
  it("validates checkout IDs", async () => expect((await POST(request({ checkoutId: "bad id" }), { params: Promise.resolve({}) })).status).toBe(400));
  it("returns the confirmed plan", async () => { confirmCheckout.mockResolvedValue({ plan: "pro", checkout: "succeeded" }); const response = await POST(request({ checkoutId: "co_1" }), { params: Promise.resolve({}) }); expect(await response.json()).toEqual({ plan: "pro", checkout: "succeeded" }); });
});
