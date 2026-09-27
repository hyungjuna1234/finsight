import "server-only";

import { resolveMonth } from "@/lib/analytics/dashboard";
import { monthRange, monthsBetween } from "@/lib/domain/month";
import { escapeLike, type TxFilters } from "@/lib/domain/tx-filters";
import type { TxView, YearMonth } from "@/lib/domain/types";
import { AppError } from "@/lib/domain/errors";
import { requireConsent, requireUser } from "@/server/auth";
import { loadDataMonthSpan, toTxView, type TxRow } from "@/server/tx-rows";
import { createServerSupabase } from "@/services/supabase/server";

export const TX_PAGE_SIZE = 100;
export type TxListData = { state: "empty" } | { state: "ready"; month: YearMonth; availableMonths: YearMonth[]; filters: TxFilters; items: TxView[]; nextCursor: number | null; cards: { id: string; name: string }[] };
const COLUMNS = "id,card_id,occurred_on,merchant_raw,merchant_key,amount_krw,kind,status,category,category_source,installment_months,foreign_amount,foreign_currency";

export async function listTransactions(filters: TxFilters): Promise<TxListData> {
  const user = await requireUser();
  await requireConsent(user.id);
  const sb = await createServerSupabase(); const span = await loadDataMonthSpan(sb, user.id); if (!span) return { state: "empty" };
  const availableMonths = monthsBetween(span.first, span.last).reverse(); const month = resolveMonth(filters.month, availableMonths); const range = monthRange(month);
  let query = sb.from("transactions").select(COLUMNS).eq("user_id", user.id).gte("occurred_on", range.from).lte("occurred_on", range.to);
  if (filters.category) query = query.eq("category", filters.category); if (filters.cardId) query = query.eq("card_id", filters.cardId); if (filters.q) query = query.ilike("merchant_raw", `%${escapeLike(filters.q)}%`);
  const { data, error } = await query.order("occurred_on", { ascending: false }).order("id", { ascending: false }).range(filters.cursor, filters.cursor + TX_PAGE_SIZE);
  if (error) throw new AppError("INTERNAL"); const rows = data as TxRow[];
  const { data: cards, error: cardsError } = await sb.from("cards").select("id,name").eq("user_id", user.id).order("name");
  if (cardsError) throw new AppError("INTERNAL");
  return { state: "ready", month, availableMonths, filters: { ...filters, month }, items: rows.slice(0, TX_PAGE_SIZE).map(toTxView), nextCursor: rows.length > TX_PAGE_SIZE ? filters.cursor + TX_PAGE_SIZE : null, cards: cards ?? [] };
}
