import "server-only";

import { AppError } from "@/lib/domain/errors";
import type { IsoDate } from "@/lib/domain/types";
import { requireUser } from "@/server/auth";
import { createServerSupabase } from "@/services/supabase/server";

export interface UploadListItem {
  id: string;
  filename: string;
  status: "uploaded" | "awaiting_confirm" | "done" | "failed";
  createdAt: string;
  periodFrom: IsoDate | null;
  periodTo: IsoDate | null;
  inserted: number | null;
  cardName: string | null;
  originalDeleted: boolean;
}
export interface CardListItem { id: string; name: string }

function insertedCount(value: unknown): number | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const inserted = (value as Record<string, unknown>).inserted;
  return typeof inserted === "number" && Number.isInteger(inserted) && inserted >= 0 ? inserted : null;
}

export async function getSettings(): Promise<{ uploads: UploadListItem[]; cards: CardListItem[] }> {
  await requireUser();
  const supabase = await createServerSupabase();
  const [uploadsResult, cardsResult] = await Promise.all([
    supabase.from("uploads").select("id,filename,status,created_at,period_from,period_to,counts,original_deleted_at,card_id").order("created_at", { ascending: false }),
    supabase.from("cards").select("id,name").order("created_at", { ascending: false }),
  ]);
  if (uploadsResult.error || cardsResult.error) throw new AppError("INTERNAL");
  const cards = (cardsResult.data ?? []).map((row) => ({ id: row.id, name: row.name }));
  const cardNames = new Map(cards.map((card) => [card.id, card.name]));
  return {
    uploads: (uploadsResult.data ?? []).map((row) => ({
      id: row.id, filename: row.filename, status: row.status, createdAt: row.created_at,
      periodFrom: row.period_from as IsoDate | null, periodTo: row.period_to as IsoDate | null,
      inserted: insertedCount(row.counts), cardName: row.card_id ? cardNames.get(row.card_id) ?? null : null,
      originalDeleted: row.original_deleted_at !== null,
    })),
    cards,
  };
}
