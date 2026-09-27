import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/domain/errors";
const { sendChatMessage } = vi.hoisted(() => ({ sendChatMessage: vi.fn() }));
vi.mock("@/server/actions/chat", () => ({ sendChatMessage }));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: "u", email: null }), requireConsent: async () => undefined }));
import { POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
describe("POST /api/chat", () => {
  beforeEach(() => { sendChatMessage.mockReset(); sendChatMessage.mockResolvedValue({ text: "답변" }); });
  it("returns 400 for a 501-character message", async () => expect((await POST(request({ history: [], message: "가".repeat(501) }), { params: Promise.resolve({}) })).status).toBe(400));
  it.each([["PRO_REQUIRED", 402], ["RATE_LIMITED", 429]] as const)("propagates %s", async (code, status) => { sendChatMessage.mockRejectedValueOnce(new AppError(code)); expect((await POST(request({ history: [], message: "질문" }), { params: Promise.resolve({}) })).status).toBe(status); });
  it("returns JSON", async () => { const response = await POST(request({ history: [], message: "질문" }), { params: Promise.resolve({}) }); expect(response.status).toBe(200); expect(await response.json()).toEqual({ text: "답변" }); });
});
