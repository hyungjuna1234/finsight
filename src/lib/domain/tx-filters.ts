import { isCategory, type Category } from "./categories";
import { isYearMonth } from "./month";
import type { YearMonth } from "./types";

export interface TxFilters { month: YearMonth | null; category: Category | null; cardId: string | null; q: string | null; cursor: number }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export function parseTxFilters(sp: Record<string, string | string[] | undefined>): TxFilters {
  const month = first(sp.month); const category = first(sp.category); const cardId = first(sp.cardId); const rawQ = first(sp.q); const rawCursor = first(sp.cursor);
  const q = rawQ?.trim() ?? "";
  const cursor = Number(rawCursor);
  return { month: month && isYearMonth(month) ? month : null, category: isCategory(category) ? category : null, cardId: cardId && UUID.test(cardId) ? cardId : null, q: q.length >= 1 && q.length <= 50 ? q : null, cursor: Number.isInteger(cursor) && cursor >= 0 ? cursor : 0 };
}

export function toTxFilterQuery(f: Partial<TxFilters>): string {
  const params = new URLSearchParams();
  if (f.month) params.set("month", f.month); if (f.category) params.set("category", f.category); if (f.cardId) params.set("cardId", f.cardId); if (f.q) params.set("q", f.q); if (f.cursor) params.set("cursor", String(f.cursor));
  const query = params.toString(); return query ? `?${query}` : "";
}

export function escapeLike(q: string): string { return q.replace(/[\\%_]/g, "\\$&"); }
