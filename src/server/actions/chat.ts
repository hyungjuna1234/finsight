import "server-only";

import { z } from "zod";
import { groupSpending, toSearchRows } from "@/lib/analytics/group";
import { CATEGORIES } from "@/lib/domain/categories";
import { CHAT_LIMITS, normalizeHistory, type ChatTurn } from "@/lib/domain/chat";
import { daysBetween, isIsoDate, kstToday } from "@/lib/domain/month";
import { escapeLike } from "@/lib/domain/tx-filters";
import type { IsoDate } from "@/lib/domain/types";
import { requireConsent, requirePro } from "@/server/auth";
import { withAiUsage } from "@/server/ai-usage";
import { assertDailyLimit } from "@/server/limits";
import { loadTxViews, toTxView, type TxRow } from "@/server/tx-rows";
import { chat, type ChatTool } from "@/services/claude/chat";
import { createServerSupabase } from "@/services/supabase/server";

const isoDate = z.string().refine(isIsoDate).transform((value) => value as IsoDate);
const rangeMessage = "조회 기간은 시작일이 종료일보다 늦지 않은 366일 이내로 입력해 주세요.";
const callLimitMessage = "도구 호출 한도에 도달했어요. 지금까지 받은 결과로 답해 주세요.";
const TX_COLUMNS = "id,card_id,occurred_on,merchant_raw,merchant_key,amount_krw,kind,status,category,category_source,installment_months,foreign_amount,foreign_currency";

function validRange(from: IsoDate, to: IsoDate): boolean {
  return from <= to && daysBetween(from, to) <= 365;
}

export function createChatTools(userId: string, opts: { maxCalls?: number } = {}): ChatTool[] {
  const maxCalls = opts.maxCalls ?? CHAT_LIMITS.toolCallsMax;
  let calls = 0;
  const enter = (): boolean => { calls += 1; return calls <= maxCalls; };
  const summarySchema = z.object({ from: isoDate, to: isoDate, groupBy: z.enum(["category", "month", "merchant"]) }).strict();
  const searchSchema = z.object({ from: isoDate, to: isoDate, query: z.string().trim().min(1).max(50).optional(), category: z.enum(CATEGORIES).optional(), limit: z.number().int().min(1).max(CHAT_LIMITS.rowsMax).optional() }).strict();

  const summarize: ChatTool<typeof summarySchema> = {
    name: "summarize_spending",
    description: "지정 기간의 카드 지출을 카테고리, 월 또는 가맹점별로 집계해요.",
    inputSchema: summarySchema,
    run: async ({ from, to, groupBy }) => {
      if (!enter()) return callLimitMessage;
      if (!validRange(from, to)) return rangeMessage;
      const sb = await createServerSupabase();
      const txs = await loadTxViews(sb, userId, { from, to });
      const groups = groupSpending(txs, groupBy, CHAT_LIMITS.rowsMax);
      return JSON.stringify({ from, to, groupBy, total: groups.reduce((sum, group) => sum + group.amount, 0), groups });
    },
  };
  const search: ChatTool<typeof searchSchema> = {
    name: "search_transactions",
    description: "지정 기간의 카드 거래를 가맹점명이나 카테고리로 찾아요.",
    inputSchema: searchSchema,
    run: async ({ from, to, query, category, limit = CHAT_LIMITS.rowsMax }) => {
      if (!enter()) return callLimitMessage;
      if (!validRange(from, to)) return rangeMessage;
      const sb = await createServerSupabase();
      let request = sb.from("transactions").select(TX_COLUMNS).eq("user_id", userId).gte("occurred_on", from).lte("occurred_on", to);
      if (query) request = request.ilike("merchant_raw", `%${escapeLike(query)}%`);
      if (category) request = request.eq("category", category);
      const { data, error } = await request.order("occurred_on", { ascending: false }).order("id", { ascending: false }).limit(Math.min(limit, CHAT_LIMITS.rowsMax));
      if (error) return "거래 내역을 조회하지 못했어요. 다른 조건으로 답해 주세요.";
      return JSON.stringify(toSearchRows((data as TxRow[]).map(toTxView), limit));
    },
  };
  return [summarize, search];
}

export async function sendChatMessage(userId: string, input: { history: ChatTurn[]; message: string }): Promise<{ text: string }> {
  await requireConsent(userId);
  await requirePro(userId);
  await assertDailyLimit(userId, "chat");
  const { text } = await withAiUsage(userId, "chat", () => chat({ history: normalizeHistory(input.history), message: input.message, tools: createChatTools(userId), today: kstToday() }));
  return { text };
}
