import { TrackedLink } from "@/components/ui/tracked-link";
import type { ProTeaserFrom } from "@/components/ui/track";

export function ProLock({
  message = "Pro에서 전체 목록을 볼 수 있어요",
  from,
  variant = "button",
}: {
  message?: string;
  from: ProTeaserFrom;
  variant?: "button" | "link";
}): React.JSX.Element {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-left">
      <p className="text-sm text-body">{message}</p>
      <TrackedLink
        href="/pricing"
        event="pro_teaser_click"
        eventProps={{ from }}
        className={
          variant === "button"
            ? "rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
            : "text-sm text-accent underline-offset-4 hover:underline"
        }
      >
        {variant === "button" ? "Pro 시작하기" : "Pro에서 보기 →"}
      </TrackedLink>
    </div>
  );
}
