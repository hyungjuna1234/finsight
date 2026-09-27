import type { ReactNode } from "react";
import { EFFECTIVE_DATE, LEGAL_DRAFT_NOTICE } from "@/lib/domain/legal";

export function LegalDocument({ title, children }: { title: string; children: ReactNode }) {
  return <main className="mx-auto w-full max-w-5xl px-4 py-8 pb-16">
    <h1 className="text-2xl font-semibold text-ink">{title}</h1>
    <div role="note" className="mt-4 rounded-md border border-line bg-surface p-4 text-sm font-medium text-warning">
      <p>{LEGAL_DRAFT_NOTICE}</p>
      <p className="mt-1">시행일 {EFFECTIVE_DATE}</p>
    </div>
    <div className="mt-8 space-y-8 text-sm leading-relaxed text-body">{children}</div>
  </main>;
}
