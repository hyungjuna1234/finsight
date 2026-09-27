import { beforeEach, describe, expect, it, vi } from "vitest";
const { handlePolarWebhook } = vi.hoisted(() => ({ handlePolarWebhook: vi.fn() }));
vi.mock("@/server/actions/billing", () => ({ handlePolarWebhook }));
import { POST } from "./route";

describe("POST /api/webhooks/polar", () => {
  beforeEach(() => handlePolarWebhook.mockReset());
  it.each([[200, 200, { received: true }], [403, 403, { error: { code: "FORBIDDEN", message: "이 작업을 할 권한이 없어요." } }], [500, 500, { error: { code: "INTERNAL", message: "서비스 설정을 확인해 주세요." } }]])("maps action status %i", async (actionStatus, expectedStatus, body) => {
    handlePolarWebhook.mockResolvedValue({ status: actionStatus });
    const request = new Request("http://localhost/api/webhooks/polar", { method: "POST", headers: { "x-test": "yes" }, body: "raw-payload" });
    const response = await POST(request);
    expect(response.status).toBe(expectedStatus); expect(await response.json()).toEqual(body);
    expect(handlePolarWebhook).toHaveBeenCalledWith("raw-payload", request.headers);
  });
});
