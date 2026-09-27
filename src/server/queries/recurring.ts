import "server-only";

import { detectRecurring, recurringSummary, RECURRING_LOOKBACK_DAYS, type RecurringItem } from "@/lib/analytics/recurring";
import type { RecurringTotal } from "@/lib/analytics/teasers";
import { AppError } from "@/lib/domain/errors";
import { addDays, kstToday } from "@/lib/domain/month";
import type { IsoDate } from "@/lib/domain/types";
import { requireConsent, requirePro, requireUser } from "@/server/auth";
import { loadTxViews } from "@/server/tx-rows";
import { createServerSupabase } from "@/services/supabase/server";

export type RecurringData = { state: "locked"; summary: RecurringTotal } | { state: "ready"; items: RecurringItem[]; summary: RecurringTotal; asOf: IsoDate };

export async function getRecurring(): Promise<RecurringData> {
  const user = await requireUser();
  await requireConsent(user.id);
  const asOf = kstToday();
  const sb = await createServerSupabase();
  const txs = await loadTxViews(sb, user.id, { from: addDays(asOf, -(RECURRING_LOOKBACK_DAYS - 1)), to: asOf });
  const items = detectRecurring(txs, asOf);
  const summary = recurringSummary(items);
  try { await requirePro(user.id); } catch (error) {
    if (error instanceof AppError && error.code === "PRO_REQUIRED") return { state: "locked", summary };
    throw error;
  }
  return { state: "ready", items, summary, asOf };
}
