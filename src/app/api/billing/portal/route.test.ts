import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ openPortal: vi.fn(async () => ({ url: "https://portal.example" })) }));
vi.mock("@/server/actions/billing", () => ({ openPortal: mocks.openPortal }));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: "user-1", email: null }) }));
import { POST, maxDuration } from "./route";
describe("POST /api/billing/portal", () => {
  it("opens a portal without requiring consent", async () => {
    const response = await POST(new Request("http://localhost/api/billing/portal", { method: "POST" }), { params: Promise.resolve({}) });
    expect(await response.json()).toEqual({ url: "https://portal.example" });
    expect(mocks.openPortal).toHaveBeenCalledWith("user-1");
    expect(maxDuration).toBe(30);
  });
});
