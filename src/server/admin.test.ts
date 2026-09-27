import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bucket: { createSignedUploadUrl: vi.fn(), download: vi.fn(), remove: vi.fn(), list: vi.fn() },
  from: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/services/supabase/admin", () => ({ createAdminSupabase: () => ({ storage: { from: () => mocks.bucket }, from: mocks.from, auth: { admin: { deleteUser: mocks.deleteUser } } }) }));

import { adminAuth, adminEntitlements, adminStorage, adminUploads, storagePathFor } from "./admin";

const uid = "11111111-1111-4111-8111-111111111111";

describe("admin auth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hard-deletes a user without passing the soft-delete flag", async () => {
    mocks.deleteUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(adminAuth.deleteUser(uid)).resolves.toBeUndefined();
    expect(mocks.deleteUser).toHaveBeenCalledWith(uid);
  });

  it.each([
    { status: 404, message: "private" },
    { status: 400, message: "User not found" },
  ])("treats a missing user as an idempotent success", async (error) => {
    mocks.deleteUser.mockResolvedValue({ data: { user: null }, error });
    await expect(adminAuth.deleteUser(uid)).resolves.toBeUndefined();
  });

  it("maps other errors to INTERNAL", async () => {
    mocks.deleteUser.mockResolvedValue({ data: { user: null }, error: { status: 500, code: "unexpected", message: "private" } });
    await expect(adminAuth.deleteUser(uid)).rejects.toMatchObject({ code: "INTERNAL" });
  });
});

describe("admin storage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a non-upsert signed upload URL", async () => {
    mocks.bucket.createSignedUploadUrl.mockResolvedValue({ data: { signedUrl: "signed" }, error: null });
    await expect(adminStorage.createUploadUrl(storagePathFor(uid, crypto.randomUUID()))).resolves.toBe("signed");
    expect(mocks.bucket.createSignedUploadUrl).toHaveBeenCalledWith(expect.any(String));
  });

  it("rejects unsafe paths and prefixes", async () => {
    await expect(adminStorage.read("/bad")).rejects.toThrow();
    await expect(adminStorage.removePrefix(`${uid}/folder`)).rejects.toThrow();
    await expect(adminStorage.remove([`${uid}/../other`])).rejects.toThrow();
  });

  it("lists expired originals with a bounded query", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: "upload-1", storage_path: `${uid}/upload/original` }], error: null });
    const order = vi.fn(() => ({ limit }));
    const lt = vi.fn(() => ({ order }));
    const is = vi.fn(() => ({ lt }));
    const select = vi.fn(() => ({ is }));
    mocks.from.mockReturnValue({ select });
    const before = new Date("2026-06-29T00:00:00.000Z");

    await expect(adminStorage.listExpiredOriginals(before, 200)).resolves.toEqual([
      { id: "upload-1", storagePath: `${uid}/upload/original` },
    ]);
    expect(is).toHaveBeenCalledWith("original_deleted_at", null);
    expect(lt).toHaveBeenCalledWith("created_at", before.toISOString());
    expect(limit).toHaveBeenCalledWith(200);
  });
});

describe("admin uploads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks only originals that are not already marked", async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: "one" }], error: null });
    const inIds = vi.fn(() => ({ select }));
    const is = vi.fn(() => ({ in: inIds }));
    const update = vi.fn(() => ({ is }));
    mocks.from.mockReturnValue({ update });
    const at = new Date("2026-09-27T00:00:00.000Z");

    await expect(adminUploads.markOriginalDeleted(["one", "two"], at)).resolves.toBe(1);
    expect(update).toHaveBeenCalledWith({ original_deleted_at: at.toISOString() });
    expect(is).toHaveBeenCalledWith("original_deleted_at", null);
  });

  it("lists only stale uploaded rows", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn(() => ({ limit }));
    const lt = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ lt }));
    const select = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ select });
    const before = new Date("2026-09-26T00:00:00.000Z");

    await adminUploads.listStale(before, 200);
    expect(eq).toHaveBeenCalledWith("status", "uploaded");
    expect(lt).toHaveBeenCalledWith("created_at", before.toISOString());
  });

  it("rechecks status and age when deleting stale rows", async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: "one" }], error: null });
    const lt = vi.fn(() => ({ select }));
    const eq = vi.fn(() => ({ lt }));
    const inIds = vi.fn(() => ({ eq }));
    const remove = vi.fn(() => ({ in: inIds }));
    mocks.from.mockReturnValue({ delete: remove });
    const before = new Date("2026-09-26T00:00:00.000Z");

    await expect(adminUploads.deleteStale(["one"], before)).resolves.toBe(1);
    expect(eq).toHaveBeenCalledWith("status", "uploaded");
    expect(lt).toHaveBeenCalledWith("created_at", before.toISOString());
  });
});

describe("adminEntitlements.upsertIfNewer", () => {
  const startedAt = new Date("2026-09-27T01:02:03.004Z");
  const value = { plan: "pro" as const, status: "active", periodEnd: new Date("2026-10-27T00:00:00Z") };

  function updateResult(data: unknown[], error: unknown = null) {
    const select = vi.fn().mockResolvedValue({ data, error });
    const or = vi.fn(() => ({ select }));
    const eq = vi.fn(() => ({ or }));
    const update = vi.fn(() => ({ eq }));
    return { update, eq, or, select };
  }

  beforeEach(() => { vi.clearAllMocks(); });

  it("uses a quoted conditional timestamp and preserves free insight state", async () => {
    const chain = updateResult([{ user_id: uid }]);
    mocks.from.mockReturnValue({ update: chain.update });
    await expect(adminEntitlements.upsertIfNewer(uid, value, startedAt)).resolves.toBe("updated");
    expect(chain.update).toHaveBeenCalledWith({ plan: "pro", status: "active", period_end: "2026-10-27T00:00:00.000Z", synced_at: startedAt.toISOString() });
    expect(chain.or).toHaveBeenCalledWith(`synced_at.is.null,synced_at.lt."${startedAt.toISOString()}"`);
  });

  it("inserts after a zero-row update", async () => {
    const chain = updateResult([]);
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ update: chain.update, insert });
    await expect(adminEntitlements.upsertIfNewer(uid, value, startedAt)).resolves.toBe("updated");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: uid, synced_at: startedAt.toISOString() }));
  });

  it("retries update after an insert conflict and reports stale", async () => {
    const first = updateResult([]); const second = updateResult([]);
    const update = vi.fn().mockImplementationOnce(first.update).mockImplementationOnce(second.update);
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    mocks.from.mockReturnValue({ update, insert });
    await expect(adminEntitlements.upsertIfNewer(uid, value, startedAt)).resolves.toBe("stale");
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("returns unknown_user for a missing auth user", async () => {
    const chain = updateResult([]);
    mocks.from.mockReturnValue({ update: chain.update, insert: vi.fn().mockResolvedValue({ error: { code: "23503" } }) });
    await expect(adminEntitlements.upsertIfNewer(uid, value, startedAt)).resolves.toBe("unknown_user");
  });
});
