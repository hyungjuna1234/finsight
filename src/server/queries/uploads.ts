import "server-only";

import { z } from "zod";
import { requireUser } from "@/server/auth";
import { createServerSupabase } from "@/services/supabase/server";

export async function getUploadPageData(): Promise<{ cards: { id: string; name: string }[]; hasUploads: boolean }> {
  const user = await requireUser();
  const supabase = await createServerSupabase();
  const [cardsResult, uploadsResult] = await Promise.all([
    supabase.from("cards").select("id,name").eq("user_id", user.id).order("created_at"),
    supabase.from("uploads").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "done"),
  ]);
  if (cardsResult.error || uploadsResult.error) throw new Error("UPLOAD_QUERY_FAILED");
  return { cards: cardsResult.data ?? [], hasUploads: (uploadsResult.count ?? 0) > 0 };
}

export async function getUploadReview(uploadId: string): Promise<{ upload: { id: string; filename: string; status: string }; cards: { id: string; name: string }[] } | null> {
  const user = await requireUser();
  if (!z.uuid().safeParse(uploadId).success) return null;
  const supabase = await createServerSupabase();
  const [uploadResult, cardsResult] = await Promise.all([
    supabase.from("uploads").select("id,filename,status").eq("user_id", user.id).eq("id", uploadId).maybeSingle(),
    supabase.from("cards").select("id,name").eq("user_id", user.id).order("created_at"),
  ]);
  if (uploadResult.error || cardsResult.error) throw new Error("UPLOAD_QUERY_FAILED");
  return uploadResult.data ? { upload: uploadResult.data, cards: cardsResult.data ?? [] } : null;
}
