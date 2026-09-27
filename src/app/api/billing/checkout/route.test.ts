import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ startCheckout: vi.fn() }));
vi.mock("@/server/actions/billing", () => ({ startCheckout: mocks.startCheckout }));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: "user-1", email: "u@example.com" }), requireConsent: async () => undefined }));
import { POST, maxDuration } from "./route";
const request = (body: unknown, headers?: HeadersInit) => new Request("http://localhost/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
describe("POST /api/billing/checkout", () => {
  beforeEach(() => mocks.startCheckout.mockReset().mockResolvedValue({ url: "https://checkout.example" }));
  it("passes a validated return path and client IP", async () => {
    const response = await POST(request({ returnTo: "/dashboard" }, { "x-forwarded-for": "203.0.113.4, 10.0.0.1" }), { params: Promise.resolve({}) });
    expect(await response.json()).toEqual({ url: "https://checkout.example" });
    expect(mocks.startCheckout).toHaveBeenCalledWith({ id: "user-1", email: "u@example.com" }, { returnTo: "/dashboard", ipAddress: "203.0.113.4" });
    expect(maxDuration).toBe(30);
  });
  it("rejects oversized return paths", async () => expect((await POST(request({ returnTo: "x".repeat(201) }), { params: Promise.resolve({}) })).status).toBe(400));
});
