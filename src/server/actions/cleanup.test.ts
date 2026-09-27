import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row { id: string; storagePath: string; createdAt: Date; status: "uploaded" | "awaiting_confirm" | "done"; originalDeletedAt: Date | null }

const fake = vi.hoisted(() => ({
  rows: [] as Row[], files: new Set<string>(), failRemove: false,
  info: vi.fn(), listExpiredCalls: 0, listStaleCalls: 0,
}));

vi.mock("@/server/admin", () => ({
  adminStorage: {
    listExpiredOriginals: vi.fn(async (before: Date, limit: number) => {
      fake.listExpiredCalls += 1;
      return fake.rows.filter((row) => row.createdAt < before && row.originalDeletedAt === null).slice(0, limit);
    }),
    remove: vi.fn(async (paths: string[]) => {
      if (fake.failRemove) throw new Error("storage failed");
      paths.forEach((path) => fake.files.delete(path));
    }),
  },
  adminUploads: {
    markOriginalDeleted: vi.fn(async (ids: string[], at: Date) => {
      let count = 0;
      fake.rows.forEach((row) => { if (ids.includes(row.id) && row.originalDeletedAt === null) { row.originalDeletedAt = at; count += 1; } });
      return count;
    }),
    listStale: vi.fn(async (before: Date, limit: number) => {
      fake.listStaleCalls += 1;
      return fake.rows.filter((row) => row.status === "uploaded" && row.createdAt < before).slice(0, limit);
    }),
    deleteStale: vi.fn(async (ids: string[], before: Date) => {
      const removable = new Set(fake.rows.filter((row) => ids.includes(row.id) && row.status === "uploaded" && row.createdAt < before).map((row) => row.id));
      fake.rows = fake.rows.filter((row) => !removable.has(row.id));
      return removable.size;
    }),
  },
}));
vi.mock("@/server/logger", () => ({ logger: { info: fake.info } }));

import { runCleanup } from "./cleanup";

const now = new Date("2026-09-27T12:00:00.000Z");
const ago = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);
const row = (id: string, hours: number, status: Row["status"]): Row => ({ id, storagePath: `11111111-1111-4111-8111-111111111111/${id}/original`, createdAt: ago(hours), status, originalDeletedAt: null });

describe("runCleanup", () => {
  beforeEach(() => {
    fake.rows = []; fake.files = new Set(); fake.failRemove = false; fake.listExpiredCalls = 0; fake.listStaleCalls = 0; vi.clearAllMocks();
  });

  it("expires 91-day originals but keeps 89-day originals", async () => {
    fake.rows = [row("old", 91 * 24, "done"), row("recent", 89 * 24, "done")];
    fake.files = new Set(fake.rows.map((item) => item.storagePath));
    await expect(runCleanup(now)).resolves.toEqual({ originals: 1, staleUploads: 0 });
    expect(fake.files.has(fake.rows[0]!.storagePath)).toBe(false);
    expect(fake.rows[0]!.originalDeletedAt).toEqual(now);
    expect(fake.files.has(fake.rows[1]!.storagePath)).toBe(true);
  });

  it("deletes only uploaded rows older than 24 hours and is idempotent", async () => {
    fake.rows = [row("old-upload", 25, "uploaded"), row("new-upload", 23, "uploaded"), row("confirming", 25, "awaiting_confirm")];
    fake.files = new Set(fake.rows.map((item) => item.storagePath));
    await expect(runCleanup(now)).resolves.toEqual({ originals: 0, staleUploads: 1 });
    expect(fake.rows.map(({ id }) => id)).toEqual(["new-upload", "confirming"]);
    await expect(runCleanup(now)).resolves.toEqual({ originals: 0, staleUploads: 0 });
  });

  it("does not mark or delete rows when file removal fails", async () => {
    fake.rows = [row("old", 91 * 24, "done")]; fake.files.add(fake.rows[0]!.storagePath); fake.failRemove = true;
    await expect(runCleanup(now)).rejects.toThrow("storage failed");
    expect(fake.rows[0]!.originalDeletedAt).toBeNull();
  });

  it("runs at most five batches of 200 per phase", async () => {
    fake.rows = Array.from({ length: 1_201 }, (_, index) => row(`old-${index}`, 91 * 24, "done"));
    fake.files = new Set(fake.rows.map((item) => item.storagePath));
    await expect(runCleanup(now)).resolves.toEqual({ originals: 1_000, staleUploads: 0 });
    expect(fake.listExpiredCalls).toBe(5);
    expect(fake.rows.filter((item) => item.originalDeletedAt === null)).toHaveLength(201);
  });
});
