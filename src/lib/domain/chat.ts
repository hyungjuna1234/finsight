import { z } from "zod";

export const CHAT_EXAMPLES: readonly string[] = [
  "이번 달 식비는 어디에 가장 많이 썼어?",
  "지난달보다 늘어난 지출은 뭐야?",
  "구독 결제만 모아서 보여줘",
  "카페에 한 달에 얼마 쓰는지 알려줘",
];

export const CHAT_LIMITS = { messageMax: 500, historyTurns: 10, assistantMax: 4000, toolCallsMax: 5, rowsMax: 30 } as const;

export interface ChatTurn { role: "user" | "assistant"; content: string }

const ChatTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(CHAT_LIMITS.assistantMax),
}).strict();

export const ChatRequestSchema = z.object({
  history: z.array(ChatTurnSchema).max(40),
  message: z.string().trim().min(1).max(CHAT_LIMITS.messageMax),
}).strict();

export function normalizeHistory(history: ChatTurn[]): ChatTurn[] {
  const recent = history
    .filter((turn) => turn.content.trim().length > 0)
    .slice(-(CHAT_LIMITS.historyTurns * 2));
  while (recent[0]?.role === "assistant") recent.shift();
  while (recent.at(-1)?.role === "user") recent.pop();
  return recent.map((turn) => ({
    role: turn.role,
    content: turn.content.slice(0, turn.role === "user" ? CHAT_LIMITS.messageMax : CHAT_LIMITS.assistantMax),
  }));
}
