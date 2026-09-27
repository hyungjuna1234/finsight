import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runCleanup: vi.fn() }));
vi.mock("@/server/actions/cleanup", () => ({ runCleanup: mocks.runCleanup }));

import { GET, maxDuration } from "./route";

const route = { params: Promise.resolve({}) };

describe("cleanup cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://finsight.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic");
    vi.stubEnv("POLAR_ACCESS_TOKEN", "polar");
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "webhook");
    vi.stubEnv("POLAR_SERVER", "sandbox");
    vi.stubEnv("POLAR_PRO_PRODUCT_ID", "product");
    mocks.runCleanup.mockResolvedValue({ originals: 2, staleUploads: 3 });
  });

  it.each([undefined, "Bearer wrong"])("rejects a missing or wrong authorization header", async (authorization) => {
    const headers = authorization ? { authorization } : undefined;
    const response = await GET(new Request("https://finsight.example/api/cron/cleanup", { headers }), route);
    expect(response.status).toBe(401);
    expect(mocks.runCleanup).not.toHaveBeenCalled();
  });

  it("runs cleanup with the current time for the correct secret", async () => {
    const response = await GET(new Request("https://finsight.example/api/cron/cleanup", { headers: { authorization: "Bearer cron-secret" } }), route);
    expect(maxDuration).toBe(60);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ removed: { originals: 2, staleUploads: 3 } });
    expect(mocks.runCleanup).toHaveBeenCalledWith(expect.any(Date));
  });
});
