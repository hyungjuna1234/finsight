import { ProLock } from "@/components/pro/pro-lock";
import { RecurringList } from "@/components/pro/recurring-list";
import { RecurringSummary } from "@/components/pro/recurring-summary";
import { getRecurring } from "@/server/queries/recurring";

export default async function RecurringPage() {
  const data = await getRecurring();
  if (data.summary.count === 0) return <main className="space-y-8"><h1 className="text-2xl font-semibold text-ink">정기결제</h1><p className="text-sm text-muted">아직 정기결제를 찾지 못했어요. 석 달 이상 내역을 올리면 찾아 드려요.</p></main>;
  return <main className="space-y-8"><h1 className="text-2xl font-semibold text-ink">정기결제</h1><RecurringSummary {...data.summary} />{data.state === "locked" ? <ProLock from="recurring" /> : <RecurringList items={data.items} />}</main>;
}
