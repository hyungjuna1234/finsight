import { beforeEach, describe, expect, it, vi } from "vitest";

const bucket = { createSignedUploadUrl: vi.fn(), download: vi.fn(), remove: vi.fn(), list: vi.fn() };
vi.mock("@/services/supabase/admin", () => ({ createAdminSupabase: () => ({ storage: { from: () => bucket } }) }));

import { adminStorage, storagePathFor } from "./admin";

const uid = "11111111-1111-4111-8111-111111111111";

describe("admin storage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a non-upsert signed upload URL", async () => {
    bucket.createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "signed" }, error: null });
    await expect(adminStorage.createUploadUrl(storagePathFor(uid, crypto.randomUUID()))).resolves.toBe("signed");
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(expect.any(String));
  });

  it("rejects unsafe paths and prefixes", async () => {
    await expect(adminStorage.read("/bad")).rejects.toThrow();
    await expect(adminStorage.removePrefix(`${uid}/folder`)).rejects.toThrow();
    await expect(adminStorage.remove([`${uid}/../other`])).rejects.toThrow();
  });
});
