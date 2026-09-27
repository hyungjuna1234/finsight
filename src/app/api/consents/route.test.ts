import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordConsentsMock, handlerMock } = vi.hoisted(() => ({
  recordConsentsMock: vi.fn(),
  handlerMock: vi.fn((options, callback) => ({ options, callback })),
}));

vi.mock("@/server/actions/consents", () => ({ recordConsents: recordConsentsMock }));
vi.mock("@/server/handler", () => ({ handler: handlerMock }));

import { POST } from "./route";

describe("POST /api/consents", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses authenticated validation and records session-user consent", async () => {
    const route = POST as unknown as {
      options: { auth: string; body: { safeParse: (value: unknown) => { success: boolean } } };
      callback: (context: { body: { kinds: string[] }; user: { id: string } }) => Promise<void>;
    };
    const body = { kinds: ["privacy", "overseas_transfer", "terms", "age14"] };

    expect(route.options.auth).toBe("user");
    expect(route.options.body.safeParse(body).success).toBe(true);
    await route.callback({ body, user: { id: "user-1" } });
    expect(recordConsentsMock).toHaveBeenCalledWith("user-1", body.kinds);
  });
});
