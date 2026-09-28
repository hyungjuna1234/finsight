import { collapseCategories, type MonthSummary } from "./month";
import { withSubject } from "@/lib/domain/korean";
import { formatKRW, toKRW } from "@/lib/domain/money";
import { formatMonthLabel } from "@/lib/domain/month";

export function monthHeadline(summary: MonthSummary): string | null {
  if (summary.count === 0) return null;

  const month = formatMonthLabel(summary.month, "short");
  if (summary.net <= 0) return `${month}에는 환불이 더 많았어요.`;

  const firstSentence = `${month}에 ${formatKRW(toKRW(summary.net))} 썼어요.`;
  const categories = collapseCategories(summary.byCategory);
  const total = categories.reduce((sum, item) => sum + item.amount, 0);
  const leading = categories.find((item) => item.category !== "기타") ?? categories[0];
  if (!leading || total === 0) return firstSentence;

  const share = Math.round((leading.amount / total) * 100);
  return `${firstSentence} ${withSubject(leading.category)} ${share}%로 가장 많아요.`;
}
