import "server-only";

import { AppError } from "@/lib/domain/errors";
import type { Plan } from "@/lib/domain/types";
import { createAdminSupabase } from "@/services/supabase/admin";

const UUID_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i;

function safePath(path: string): void {
  if (!UUID_PATH.test(path) || path.startsWith("/") || path.split("/").includes("..")) throw new Error("Unsafe storage path");
}

function bucket() { return createAdminSupabase().storage.from("statements"); }
function internal(): never { throw new AppError("INTERNAL"); }

export function storagePathFor(userId: string, uploadId: string): string {
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
};
