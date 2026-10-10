import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  bucket: { createSignedUploadUrl: vi.fn(), download: vi.fn(), remove: vi.fn(), list: vi.fn() },
  from: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/services/supabase/admin", () => ({ createAdminSupabase: () => ({ storage: { from: () => mocks.bucket }, from: mocks.from, auth: { admin: { deleteUser: mocks.deleteUser } } }) }));

import { adminAuth, adminEntitlements, adminStorage, adminUploads, storagePathFor } from "./admin";

const uid = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";

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
    const limit = vi.fn().mockResolvedValue({ data: [{ id: uploadId, user_id: uid, storage_path: "untrusted/path" }], error: null });
    const order = vi.fn(() => ({ limit }));
    const lt = vi.fn(() => ({ order }));
    const is = vi.fn(() => ({ lt }));
    const select = vi.fn(() => ({ is }));
    mocks.from.mockReturnValue({ select });
    const before = new Date("2026-06-29T00:00:00.000Z");

    await expect(adminStorage.listExpiredOriginals(before, 200)).resolves.toEqual([
      { id: uploadId, storagePath: `${uid}/${uploadId}/original` },
    ]);
    expect(select).toHaveBeenCalledWith("id,user_id");
    expect(is).toHaveBeenCalledWith("original_deleted_at", null);
    expect(lt).toHaveBeenCalledWith("created_at", before.toISOString());
    expect(limit).toHaveBeenCalledWith(200);
  });

  it("omits an invalid cleanup row without failing the batch", async () => {
    const validId = "33333333-3333-4333-8333-333333333333";
    const limit = vi.fn().mockResolvedValue({
      data: [
        { id: uploadId, user_id: "not-a-uuid" },
        { id: "not-a-uuid", user_id: uid },
        { id: validId, user_id: uid },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ is: vi.fn(() => ({ lt: vi.fn(() => ({ order: vi.fn(() => ({ limit })) })) })) }));
    mocks.from.mockReturnValue({ select });

    await expect(adminStorage.listExpiredOriginals(new Date(), 200)).resolves.toEqual([
      { id: validId, storagePath: `${uid}/${validId}/original` },
    ]);
  });

  it("keeps cleanup rows whose uuids have any version so they cannot block the queue", async () => {
    const nil = "00000000-0000-0000-0000-000000000000";
    const versionZero = "33333333-3333-0333-0333-333333333333";
    const limit = vi.fn().mockResolvedValue({ data: [{ id: nil, user_id: uid }, { id: versionZero, user_id: nil }], error: null });
    const select = vi.fn(() => ({ is: vi.fn(() => ({ lt: vi.fn(() => ({ order: vi.fn(() => ({ limit })) })) })) }));
    mocks.from.mockReturnValue({ select });

    await expect(adminStorage.listExpiredOriginals(new Date(), 200)).resolves.toEqual([
      { id: nil, storagePath: `${uid}/${nil}/original` },
      { id: versionZero, storagePath: `${nil}/${versionZero}/original` },
    ]);
  });
});

describe("admin uploads", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an upload row with a server-built storage path", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ insert });
    const uploadId = "3ae40653-f46b-48ee-a316-8717841740c6";
    const userId = "11111111-1111-4111-8111-111111111111";
    await expect(adminUploads.create({ userId, uploadId, filename: "card.csv", sha256: "a".repeat(64), byteSize: 10 })).resolves.toBe("created");
    expect(mocks.from).toHaveBeenCalledWith("uploads");
    expect(insert).toHaveBeenCalledWith({ id: uploadId, user_id: userId, storage_path: `${userId}/${uploadId}/original`, filename: "card.csv", sha256: "a".repeat(64), byte_size: 10, status: "uploaded" });
  });

  it("throws INTERNAL without details for other insert errors", async () => {
    mocks.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { code: "42501", message: "private detail" } }) });
    const error = await adminUploads.create({ userId: "11111111-1111-4111-8111-111111111111", uploadId: "3ae40653-f46b-48ee-a316-8717841740c6", filename: "a.csv", sha256: "c".repeat(64), byteSize: 1 }).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "INTERNAL" });
    expect(JSON.stringify(error)).not.toContain("private detail");
  });

  it("reports a concurrent duplicate upload instead of failing", async () => {
    mocks.from.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { code: "23505" } }) });
    await expect(adminUploads.create({ userId: "11111111-1111-4111-8111-111111111111", uploadId: "3ae40653-f46b-48ee-a316-8717841740c6", filename: "a.csv", sha256: "b".repeat(64), byteSize: 1 })).resolves.toBe("duplicate");
  });

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
    const limit = vi.fn().mockResolvedValue({ data: [{ id: uploadId, user_id: uid, storage_path: "untrusted/path" }], error: null });
    const order = vi.fn(() => ({ limit }));
    const lt = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ lt }));
    const select = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ select });
    const before = new Date("2026-09-26T00:00:00.000Z");

    await expect(adminUploads.listStale(before, 200)).resolves.toEqual([
      { id: uploadId, storagePath: `${uid}/${uploadId}/original` },
    ]);
    expect(select).toHaveBeenCalledWith("id,user_id");
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
  const value = { plan: "pro" as const, status: "active", periodEnd: new Date("2026-10-27T00:00:00Z"), cancelAtPeriodEnd: true };

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
    expect(chain.update).toHaveBeenCalledWith({ plan: "pro", status: "active", period_end: "2026-10-27T00:00:00.000Z", cancel_at_period_end: true, synced_at: startedAt.toISOString() });
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

describe("adminEntitlements.releaseFreeInsight", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("clears the free insight timestamp for the user", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ update });

    await expect(adminEntitlements.releaseFreeInsight(uid)).resolves.toBeUndefined();

    expect(mocks.from).toHaveBeenCalledWith("entitlements");
    expect(update).toHaveBeenCalledWith({ free_insight_used_at: null });
    expect(eq).toHaveBeenCalledWith("user_id", uid);
  });
});
