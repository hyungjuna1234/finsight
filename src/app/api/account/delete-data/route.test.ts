import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ deleteAllData: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/server/actions/account", () => ({ deleteAllData: mocks.deleteAllData }));
vi.mock("@/server/auth", () => ({ requireUser: mocks.requireUser, requireConsent: vi.fn() }));
vi.mock("@/server/env", () => ({ getPublicEnv: () => ({ appUrl: "http://localhost:3000" }), getServerEnv: vi.fn() }));
import { POST } from "./route";
function request(body: unknown) { return new Request("http://localhost:3000/api/account/delete-data", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); mocks.requireUser.mockResolvedValue({ id: "u1" }); });
it.each([{}, { confirm: "탈퇴" }])("정확한 문구가 아니면 400이다", async (body) => expect((await POST(request(body), { params: Promise.resolve({}) })).status).toBe(400));
it("전체 삭제 문구로 삭제하고 204를 반환한다", async () => { expect((await POST(request({ confirm: "전체 삭제" }), { params: Promise.resolve({}) })).status).toBe(204); expect(mocks.deleteAllData).toHaveBeenCalledWith("u1"); });
