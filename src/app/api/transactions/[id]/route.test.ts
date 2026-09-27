import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setCategory: vi.fn(), requireUser: vi.fn(), requireConsent: vi.fn() }));
vi.mock("@/server/actions/transactions", () => ({ setCategory: mocks.setCategory }));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser, requireConsent: mocks.requireConsent }));
vi.mock("@/server/env", () => ({ getPublicEnv: () => ({ appUrl: "http://localhost:3000" }), getServerEnv: vi.fn() }));
import { PATCH } from "./route";

const id = "550e8400-e29b-41d4-a716-446655440000";
function request(body: unknown, origin = "http://localhost:3000") { return new Request(`http://localhost:3000/api/transactions/${id}`, { method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue({ id: "u1" }); mocks.setCategory.mockResolvedValue({ updated: 2 }); });

describe("PATCH transaction category", () => {
  it("returns 400 for an invalid category", async () => expect((await PATCH(request({ category: "x", scope: "one" }), { params: Promise.resolve({ id }) })).status).toBe(400));
  it("returns 404 for a non-uuid id", async () => expect((await PATCH(request({ category: "식비", scope: "one" }), { params: Promise.resolve({ id: "bad" }) })).status).toBe(404));
  it("returns the updated count", async () => expect(await (await PATCH(request({ category: "식비", scope: "merchant" }), { params: Promise.resolve({ id }) })).json()).toEqual({ updated: 2 }));
  it("rejects a mismatched origin", async () => expect((await PATCH(request({ category: "식비", scope: "one" }, "https://evil.test"), { params: Promise.resolve({ id }) })).status).toBe(403));
});
