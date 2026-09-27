"use client";

import type { ConfirmResponse } from "@/lib/domain/upload";
import { formatPeriodLabel, toYearMonth } from "@/lib/domain/month";

export function UploadResult({ result, onRecategorize, recategorizing = false }: { result: ConfirmResponse; onRecategorize?(): void; recategorizing?: boolean }) {
  const parts: string[] = [];
  if (result.period) parts.push(formatPeriodLabel(result.period.from, result.period.to));
  parts.push(result.inserted ? `${result.inserted}건 추가` : "새로 추가된 거래가 없어요");
  if (result.duplicates) parts.push(`이미 있던 ${result.duplicates}건`);
  if (result.pending) parts.push(`분류 실패 ${result.pending}건`);
  const href = result.period ? `/dashboard?month=${toYearMonth(result.period.to)}` : "/dashboard";
  return <div className="space-y-3"><p className="text-sm font-medium text-ink tabular-nums">{parts.join(" · ")}</p><div className="flex flex-wrap gap-3">{result.pending && onRecategorize ? <button type="button" disabled={recategorizing} onClick={onRecategorize} className="rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink hover:bg-bg disabled:text-disabled">다시 분류</button> : null}<a href={href} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">대시보드 보기</a></div></div>;
}
