import type { JSX } from "react";

const STEPS = ["가입", "파일 받기", "올리기"] as const;

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      data-testid="completed-step"
      fill="none"
      viewBox="0 0 20 20"
    >
      <path d="m5 10 3 3 7-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

export function OnboardingSteps({ current }: { current: 1 | 2 | 3 }): JSX.Element {
  return (
    <ol aria-label="시작 단계" className="flex items-center text-sm">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const completed = step < current;
        const active = step === current;

        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`flex items-center whitespace-nowrap ${active ? "font-semibold text-ink" : "text-muted"}`}
          >
            {index > 0 ? <span aria-hidden="true" className="mx-2 h-px w-4 bg-line sm:w-8" /> : null}
            <span
              className={`mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                active ? "bg-accent text-white" : completed ? "text-muted" : "border border-line text-muted"
              }`}
            >
              {completed ? <CheckIcon /> : step}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}
