import "server-only";

import { AppError } from "@/lib/domain/errors";
import type { Plan } from "@/lib/domain/types";
import { logger } from "@/server/logger";
import { createAdminSupabase } from "@/services/supabase/admin";

// 버전·변형 자리는 보지 않는다. uuid 컬럼은 nil 같은 값도 받으므로, 버전을 따지면 사용자가 직접 넣은 행이 정리 큐 앞자리를 막는다.
const UUID_PATH = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\//i;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function safePath(path: string): void {
  if (!UUID_PATH.test(path) || path.startsWith("/") || path.split("/").includes("..")) throw new Error("Unsafe storage path");
}

function bucket() { return createAdminSupabase().storage.from("statements"); }
function internal(): never { throw new AppError("INTERNAL"); }

function databaseError(event: string, error: { code?: string } | null): never {
  logger.error(event, error, { code: error?.code ?? null });
  return internal();
}

function cleanupRows(data: { id: string; user_id: string }[] | null): { id: string; storagePath: string }[] {
  return (data ?? []).flatMap(({ id, user_id: userId }) => {
    try {
      return [{ id, storagePath: storagePathFor(userId, id) }];
    } catch {
      logger.warn("cleanup.invalid_row", { id });
      return [];
    }
  });
}

function authErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  return typeof candidate.statusCode === "number" ? candidate.statusCode : null;
}

export const adminAuth = {
  async deleteUser(userId: string): Promise<void> {
    const { error } = await createAdminSupabase().auth.admin.deleteUser(userId);
    if (!error) return;
    if (authErrorStatus(error) === 404 || error.message.toLowerCase().includes("user not found")) return;
    logger.warn("admin.auth.delete_user", { code: error.code ?? null });
    internal();
  },
};

export function storagePathFor(userId: string, uploadId: string): string {
  if (!UUID.test(userId) || !UUID.test(uploadId)) throw new Error("Invalid storage path id");
  const path = `${userId}/${uploadId}/original`;
  safePath(path);
  return path;
}

export const adminStorage = {
  async createUploadUrl(path: string): Promise<string> {
    safePath(path);
    const { data, error } = await bucket().createSignedUploadUrl(path);
    if (error || !data?.signedUrl) internal();
    return data.signedUrl;
  },
  async read(path: string): Promise<Uint8Array | null> {
    safePath(path);
    const { data, error } = await bucket().download(path);
    if (error) return String(error.statusCode) === "404" ? null : internal();
    return data ? new Uint8Array(await data.arrayBuffer()) : null;
  },
  async remove(paths: string[]): Promise<void> {
    paths.forEach(safePath);
    if (paths.length === 0) return;
    const { error } = await bucket().remove(paths);
    if (error) internal();
  },
  async removePrefix(prefix: string): Promise<number> {
    safePath(prefix);
    if (!prefix.endsWith("/")) throw new Error("Storage prefix must end in slash");
    const store = bucket();
    const files: string[] = [];
    async function walk(folder: string): Promise<void> {
      let offset = 0;
      for (;;) {
        const { data, error } = await store.list(folder.replace(/\/$/, ""), { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
        if (error) internal();
        const entries = data ?? [];
        for (const entry of entries) {
          const path = `${folder}${entry.name}`;
          if (entry.id === null) await walk(`${path}/`);
          else files.push(path);
        }
        if (entries.length < 100) break;
        offset += 100;
      }
    }
    await walk(prefix);
    for (let index = 0; index < files.length; index += 100) {
      const { error } = await store.remove(files.slice(index, index + 100));
      if (error) internal();
    }
    return files.length;
  },
  async listExpiredOriginals(before: Date, limit: number): Promise<{ id: string; storagePath: string }[]> {
    const { data, error } = await createAdminSupabase()
      .from("uploads")
      .select("id,user_id")
      .is("original_deleted_at", null)
      .lt("created_at", before.toISOString())
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) databaseError("admin.storage.list_expired", error);
    return cleanupRows(data);
  },
};

export const adminUploads = {
  async markOriginalDeleted(ids: string[], at: Date): Promise<number> {
    if (ids.length === 0) return 0;
    const { data, error } = await createAdminSupabase()
      .from("uploads")
      .update({ original_deleted_at: at.toISOString() })
      .is("original_deleted_at", null)
      .in("id", ids)
      .select("id");
    if (error) databaseError("admin.uploads.mark_original_deleted", error);
    return data?.length ?? 0;
  },

  async listStale(before: Date, limit: number): Promise<{ id: string; storagePath: string }[]> {
    const { data, error } = await createAdminSupabase()
      .from("uploads")
      .select("id,user_id")
      .eq("status", "uploaded")
      .lt("created_at", before.toISOString())
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) databaseError("admin.uploads.list_stale", error);
    return cleanupRows(data);
  },

  async deleteStale(ids: string[], before: Date): Promise<number> {
    if (ids.length === 0) return 0;
    const { data, error } = await createAdminSupabase()
      .from("uploads")
      .delete()
      .in("id", ids)
      .eq("status", "uploaded")
      .lt("created_at", before.toISOString())
      .select("id");
    if (error) databaseError("admin.uploads.delete_stale", error);
    return data?.length ?? 0;
  },
};

export interface EntitlementRecord {
  plan: Plan;
  status: string | null;
  periodEnd: Date | null;
  freeInsightUsedAt: Date | null;
}

export const adminEntitlements = {
  async get(userId: string): Promise<EntitlementRecord | null> {
    const { data, error } = await createAdminSupabase()
      .from("entitlements")
      .select("plan,status,period_end,free_insight_used_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) internal();
    if (!data) return null;

    return {
      plan: data.plan,
      status: data.status,
      periodEnd: data.period_end === null ? null : new Date(data.period_end),
      freeInsightUsedAt: data.free_insight_used_at === null ? null : new Date(data.free_insight_used_at),
    };
  },

  async markFreeInsightUsed(userId: string): Promise<boolean> {
    const supabase = createAdminSupabase();
    const { error: insertError } = await supabase.from("entitlements").upsert(
      {
        user_id: userId,
        plan: "free",
        status: "inactive",
        period_end: null,
        synced_at: null,
        free_insight_used_at: null,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    if (insertError) internal();

    const { data, error } = await supabase
      .from("entitlements")
      .update({ free_insight_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("free_insight_used_at", null)
      .select("user_id");
    if (error) internal();
    return data?.length === 1;
  },

  async releaseFreeInsight(userId: string): Promise<void> {
    const { error } = await createAdminSupabase()
      .from("entitlements")
      .update({ free_insight_used_at: null })
      .eq("user_id", userId);
    if (error) internal();
  },

  async upsertIfNewer(
    userId: string,
    value: { plan: Plan; status: string; periodEnd: Date | null; cancelAtPeriodEnd: boolean },
    startedAt: Date,
  ): Promise<"updated" | "stale" | "unknown_user"> {
    const supabase = createAdminSupabase();
    const iso = startedAt.toISOString();
    const payload = {
      plan: value.plan,
      status: value.status,
      period_end: value.periodEnd?.toISOString() ?? null,
      cancel_at_period_end: value.cancelAtPeriodEnd,
      synced_at: iso,
    };
    const update = async () => supabase
      .from("entitlements")
      .update(payload)
      .eq("user_id", userId)
      .or(`synced_at.is.null,synced_at.lt."${iso}"`)
      .select("user_id");

    const first = await update();
    if (first.error) {
      logger.error("admin.entitlements.update", first.error, { code: first.error.code ?? null });
      internal();
    }
    if ((first.data?.length ?? 0) > 0) return "updated";

    const { error: insertError } = await supabase.from("entitlements").insert({ user_id: userId, ...payload });
    if (!insertError) return "updated";
    if (insertError.code === "23503") return "unknown_user";
    if (insertError.code !== "23505") {
      logger.error("admin.entitlements.insert", insertError, { code: insertError.code ?? null });
      internal();
    }

    const retry = await update();
    if (retry.error) {
      logger.error("admin.entitlements.retry", retry.error, { code: retry.error.code ?? null });
      internal();
    }
    return (retry.data?.length ?? 0) > 0 ? "updated" : "stale";
  },
};
