import { TrackedLink } from "@/components/ui/tracked-link";
import { formatMonthLabel } from "@/lib/domain/month";
import type { YearMonth } from "@/lib/domain/types";

export function UploadBanner({ month }: { month: YearMonth }) {
  const label = formatMonthLabel(month, "short");
  return <aside className="flex items-center justify-between gap-3 rounded-md border border-line bg-accent-soft px-4 py-3"><p className="text-sm text-body">{label} 내역을 올릴 차례예요. 같은 카드사 형식이면 확인 없이 바로 올라가요.</p><TrackedLink href="/upload" event="next_step_click" eventProps={{ step: "stale_upload" }} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">{label} 내역 올리기</TrackedLink></aside>;
}
