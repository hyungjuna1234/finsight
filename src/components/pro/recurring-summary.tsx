import Link from "next/link";
import { formatKRW } from "@/lib/domain/money";
import type { KRW } from "@/lib/domain/types";

export function RecurringSummary({ count, monthlyTotal, href }: { count: number; monthlyTotal: KRW; href?: string }) {
  const content = <span className="tabular-nums">정기결제 {count}건 · 월 {formatKRW(monthlyTotal)}</span>;
  return href ? <Link href={href} className="text-sm text-accent underline-offset-4 hover:underline">{content}</Link> : <p className="text-sm text-muted">{content}</p>;
}
