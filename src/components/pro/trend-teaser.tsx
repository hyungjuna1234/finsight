import { ProLock } from "./pro-lock";

export function TrendTeaser({ variant = "button" }: { variant?: "button" | "link" }) {
  return <section><h3 className="text-base font-semibold text-ink">월별 추이</h3><svg aria-hidden="true" viewBox="0 0 480 120" className="mt-3 h-28 w-full select-none opacity-40"><path d="M0 108H480" stroke="#E1E5E2" /><path d="M20 92H65V108H20zM100 70H145V108H100zM180 80H225V108H180zM260 46H305V108H260zM340 58H385V108H340zM420 24H465V108H420z" fill="#5F8278" /></svg><ProLock message="Pro에서 월별 추이를 볼 수 있어요" from="trend" variant={variant} /></section>;
}
