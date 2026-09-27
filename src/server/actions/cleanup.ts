import "server-only";

import { adminStorage, adminUploads } from "@/server/admin";
import { logger } from "@/server/logger";

export interface CleanupResult {
  originals: number;
  staleUploads: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 200;
const MAX_BATCHES = 5;

export async function runCleanup(now: Date): Promise<CleanupResult> {
  const expireBefore = new Date(now.getTime() - 90 * DAY_MS);
  const staleBefore = new Date(now.getTime() - DAY_MS);
  let originals = 0;
  let staleUploads = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const rows = await adminStorage.listExpiredOriginals(expireBefore, BATCH_SIZE);
    if (rows.length === 0) break;
    await adminStorage.remove(rows.map(({ storagePath }) => storagePath));
    originals += await adminUploads.markOriginalDeleted(rows.map(({ id }) => id), now);
  }

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const rows = await adminUploads.listStale(staleBefore, BATCH_SIZE);
    if (rows.length === 0) break;
    await adminStorage.remove(rows.map(({ storagePath }) => storagePath));
    staleUploads += await adminUploads.deleteStale(rows.map(({ id }) => id), staleBefore);
  }

  logger.info("cleanup.done", { originals, staleUploads });
  return { originals, staleUploads };
}
