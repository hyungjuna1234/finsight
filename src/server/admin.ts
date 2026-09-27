import "server-only";

import { AppError } from "@/lib/domain/errors";
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
