import "server-only";

import { AppError } from "@/lib/domain/errors";
import { toKRW } from "@/lib/domain/money";
import { toYearMonth } from "@/lib/domain/month";
import type { Category } from "@/lib/domain/categories";
import type { CategorySource, IsoDate, TxView, YearMonth } from "@/lib/domain/types";
import { createServerSupabase } from "@/services/supabase/server";
import type { Database } from "@/types/database";

export type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
export type TxRow = Pick<Database["public"]["Tables"]["transactions"]["Row"], "id" | "card_id" | "occurred_on" | "merchant_raw" | "merchant_key" | "amount_krw" | "kind" | "status" | "category" | "category_source" | "installment_months" | "foreign_amount" | "foreign_currency">;

const TX_COLUMNS = "id,card_id,occurred_on,merchant_raw,merchant_key,amount_krw,kind,status,category,category_source,installment_months,foreign_amount,foreign_currency";

export function toTxView(row: TxRow): TxView {
  return { id: row.id, cardId: row.card_id, occurredOn: row.occurred_on as IsoDate, merchantRaw: row.merchant_raw, merchantKey: row.merchant_key, amountKrw: toKRW(row.amount_krw), kind: row.kind, status: row.status, category: row.category as Category, categorySource: row.category_source as CategorySource, installmentMonths: row.installment_months, foreignAmount: row.foreign_amount, foreignCurrency: row.foreign_currency };
}

export async function loadTxViews(sb: ServerSupabase, userId: string, range: { from: IsoDate; to: IsoDate }): Promise<TxView[]> {
  const output: TxView[] = [];
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await sb.from("transactions").select(TX_COLUMNS).eq("user_id", userId).gte("occurred_on", range.from).lte("occurred_on", range.to).order("occurred_on").order("id").range(from, from + 999);
    if (error) throw new AppError("INTERNAL");
    const rows = data as TxRow[];
    output.push(...rows.map(toTxView));
    if (rows.length < 1_000) return output;
  }
}

export async function hasTxInRange(sb: ServerSupabase, userId: string, range: { from: IsoDate; to: IsoDate }): Promise<boolean> {
  const { data, error } = await sb.from("transactions").select("id").eq("user_id", userId).gte("occurred_on", range.from).lte("occurred_on", range.to).limit(1);
  if (error) throw new AppError("INTERNAL");
  return data.length > 0;
}

export async function loadDataMonthSpan(sb: ServerSupabase, userId: string): Promise<{ first: YearMonth; last: YearMonth } | null> {
  const readEdge = async (ascending: boolean): Promise<IsoDate | null> => {
    const { data, error } = await sb.from("transactions").select("occurred_on").eq("user_id", userId).order("occurred_on", { ascending }).limit(1);
    if (error) throw new AppError("INTERNAL");
    return data[0]?.occurred_on as IsoDate | undefined ?? null;
  };
  const first = await readEdge(true);
  if (!first) return null;
  const last = await readEdge(false);
  if (!last) return null;
  return { first: toYearMonth(first), last: toYearMonth(last) };
}
