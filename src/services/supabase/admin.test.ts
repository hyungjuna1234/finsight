import { describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn(() => ({ from: vi.fn() })) }));

vi.mock("@supabase/supabase-js", () => ({ createClient: createClientMock }));
vi.mock("@/server/env", () => ({
  getServerEnv: () => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseServiceRoleKey: "service-role-key",
  }),
}));

import { createAdminSupabase } from "./admin";

describe("createAdminSupabase", () => {
  it("creates a non-persistent service-role client", () => {
    createAdminSupabase();

    expect(createClientMock).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-role-key",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  });
});
