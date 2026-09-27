import { summarizeMonth, type MonthSummary } from "@/lib/analytics/month";
import { isYearMonth, prevMonth, toYearMonth } from "@/lib/domain/month";
import type { IsoDate, TxView, YearMonth } from "@/lib/domain/types";

export interface DashboardModel {
  month: YearMonth;
  availableMonths: YearMonth[];
  summary: MonthSummary;
  uploadBannerMonth: YearMonth | null;
}

export function resolveMonth(requested: string | null | undefined, available: YearMonth[]): YearMonth {
  const latest = [...available].sort((a, b) => b.localeCompare(a))[0];
  if (!latest) throw new RangeError("Dashboard requires an available month");
  return requested && isYearMonth(requested) && available.includes(requested) ? requested : latest;
}

export function uploadBannerMonth(latest: YearMonth, today: IsoDate): YearMonth | null {
  const previous = prevMonth(toYearMonth(today));
  return latest < previous ? previous : null;
}

export function buildDashboardModel(i: { txs: TxView[]; month: YearMonth; availableMonths: YearMonth[]; today: IsoDate }): DashboardModel {
  const availableMonths = [...i.availableMonths].sort((a, b) => b.localeCompare(a));
  const latest = availableMonths[0];
  if (!latest) throw new RangeError("Dashboard requires an available month");
  return { month: i.month, availableMonths, summary: summarizeMonth(i.txs, i.month), uploadBannerMonth: uploadBannerMonth(latest, i.today) };
}
