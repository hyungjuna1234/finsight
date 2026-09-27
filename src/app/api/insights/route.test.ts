import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/domain/errors";
const { generateInsight } = vi.hoisted(() => ({ generateInsight: vi.fn() }));
vi.mock("@/server/actions/insights", () => ({ generateInsight }));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: "u", email: null }), requireConsent: async () => undefined }));
vi.mock("@/server/handler", async () => { const { AppError } = await import("@/lib/domain/errors"); return { handler: (opts: { body?: { safeParse(value: unknown): { success: boolean; data?: unknown } } }, fn: (ctx: unknown) => Promise<unknown>) => async (req: Request) => { const raw = await req.json(); const parsed = opts.body?.safeParse(raw); if (parsed && !parsed.success) return new Response(null, { status: 400 }); try { return Response.json(await fn({ user: { id: "u" }, body: parsed?.data })); } catch (error) { return new Response(null, { status: error instanceof AppError ? error.status : 500 }); } } }; });
import { POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/insights", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
describe("POST /api/insights", () => {
  beforeEach(() => generateInsight.mockReset());
  it("returns 400 for invalid input", async () => expect((await POST(request({ month: "bad" }), { params: Promise.resolve({}) })).status).toBe(400));
  it("returns 402 for locked users", async () => { generateInsight.mockImplementationOnce(async () => { throw new AppError("PRO_REQUIRED"); }); expect((await POST(request({ month: "2026-09" }), { params: Promise.resolve({}) })).status).toBe(402); });
  it("returns generated insight", async () => { generateInsight.mockResolvedValue({ month: "2026-09", content: { headline: "h", points: ["p"], tips: [] }, createdAt: "now" }); const response = await POST(request({ month: "2026-09" }), { params: Promise.resolve({}) }); expect(response.status).toBe(200); });
});
