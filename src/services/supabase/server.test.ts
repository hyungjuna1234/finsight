import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieSet, cookieStore, createServerClientMock } = vi.hoisted(() => {
  const cookieSet = vi.fn();
  return {
    cookieSet,
    cookieStore: { getAll: vi.fn(() => [{ name: "session", value: "old" }]), set: cookieSet },
    createServerClientMock: vi.fn((url: unknown, key: unknown, options: unknown) => {
      void url;
      void key;
      void options;
      return { auth: {} };
    }),
  };
});

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => cookieStore) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: createServerClientMock }));
vi.mock("@/server/env", () => ({
  getPublicEnv: () => ({
    appUrl: "https://finsight.test",
    supabaseUrl: "https://project.supabase.co",
    supabaseAnonKey: "anon-key",
  }),
}));

import { createServerSupabase } from "./server";

describe("createServerSupabase", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads request cookies and forces secure httpOnly cookie options in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await createServerSupabase();

    const options = createServerClientMock.mock.calls[0]?.[2] as
      | { cookies: { getAll: () => unknown; setAll?: (values: CookieValue[], headers: Record<string, string>) => void } }
      | undefined;
    expect(options?.cookies.getAll()).toEqual([{ name: "session", value: "old" }]);

    options?.cookies.setAll?.([
      {
        name: "session",
        value: "new",
        options: { httpOnly: false, sameSite: "strict", secure: false, path: "/auth" },
      },
    ], {});

    expect(cookieSet).toHaveBeenCalledWith("session", "new", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/auth",
    });
  });

  it("ignores cookie writes rejected by a Server Component", async () => {
    cookieSet.mockImplementationOnce(() => {
      throw new Error("Cookies can only be modified in a Server Action");
    });

    await createServerSupabase();
    const options = createServerClientMock.mock.calls[0]?.[2] as
      | { cookies: { setAll?: (values: CookieValue[], headers: Record<string, string>) => void } }
      | undefined;

    expect(() =>
      options?.cookies.setAll?.([{ name: "session", value: "new", options: {} }], {}),
    ).not.toThrow();
  });
});

interface CookieValue {
  name: string;
  value: string;
  options: Record<string, unknown>;
}
