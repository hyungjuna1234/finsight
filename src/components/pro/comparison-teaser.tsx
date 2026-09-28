import { formatMonthLabel } from "@/lib/domain/month";
import type { YearMonth } from "@/lib/domain/types";
import { ProLock } from "./pro-lock";

export function ComparisonTeaser({ previousMonth }: { previousMonth: YearMonth }) {
  return <section><h3 className="text-base font-semibold text-ink">전월 비교</h3><p className="mt-2 text-sm text-body">{formatMonthLabel(previousMonth, "short")}과 비교한 결과가 준비됐어요</p><ProLock message="Pro에서 전월 비교를 볼 수 있어요" from="comparison" variant="link" /></section>;
}
