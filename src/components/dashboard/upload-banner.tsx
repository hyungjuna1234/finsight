import Link from "next/link";
import { formatMonthLabel } from "@/lib/domain/month";
import type { YearMonth } from "@/lib/domain/types";

export function UploadBanner({ month }: { month: YearMonth }) {
  return <aside className="flex items-center justify-between gap-3 rounded-md border border-line bg-accent-soft px-4 py-3"><p className="text-sm text-body">{formatMonthLabel(month, "short")} 내역을 올릴 차례예요</p><Link href="/upload" className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">업로드</Link></aside>;
}
