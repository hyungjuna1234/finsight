import { TrackedLink } from "@/components/ui/tracked-link";
import type { Journey, StepKey } from "@/lib/domain/journey";
import type { YearMonth } from "@/lib/domain/types";

const labels: Record<StepKey, string> = {
  signup: "가입하기",
  first_upload: "첫 카드 내역 올리기",
  three_months: "석 달 치 채우기",
  first_insight: "첫 AI 리포트 받기 · 무료",
};

const primaryClass = "inline-block rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover";
const textClass = "text-sm text-accent underline-offset-4 hover:underline";

function CheckIcon(): React.JSX.Element {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-5 w-5 text-accent"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function StartChecklist({ journey, month }: { journey: Journey; month: YearMonth }): React.JSX.Element | null {
  if (!journey.checklist) return null;

  const completed = journey.checklist.filter((item) => item.done).length;

  return <section aria-labelledby="start-checklist-heading">
    <h2 id="start-checklist-heading" className="text-base font-semibold text-ink">시작하기 · 4단계 중 {completed}단계 완료</h2>
    <ol className="mt-3 divide-y divide-line">
      {journey.checklist.map((item, index) => {
        const progress = item.key === "three_months" && item.progress ? ` · ${item.progress.now}/${item.progress.goal}달` : "";
        const action = item.key === "first_upload"
          ? { href: "/upload", label: "내역 올리기" }
          : item.key === "three_months"
            ? { href: "/upload", label: "지난 내역 올리기" }
            : item.key === "first_insight"
              ? { href: `/insights?month=${month}`, label: "리포트 만들기" }
              : null;

        return <li key={item.key} className="flex items-start gap-3 py-3">
          <span className={item.done ? "text-accent" : "text-body"}>{item.done ? <CheckIcon /> : `${index + 1}`}</span>
          <div className="min-w-0 flex-1">
            <p className={item.done ? "text-sm text-muted" : "text-sm text-body"}>{labels[item.key]}{progress}</p>
            {item.key === "three_months" ? <p className="mt-1 text-sm text-muted">정기결제와 전월 비교를 찾아 드려요</p> : null}
            {!item.done && action ? <TrackedLink href={action.href} event="next_step_click" eventProps={{ step: item.key }} className={`mt-2 ${journey.primary === item.key ? primaryClass : textClass}`}>{action.label}</TrackedLink> : null}
          </div>
        </li>;
      })}
    </ol>
  </section>;
}
