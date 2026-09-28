import type { CSSProperties, JSX, ReactNode } from "react";
import { CHART_COLORS, CHART_OTHER_COLOR } from "@/lib/domain/chart-colors";
import { formatKRW } from "@/lib/domain/money";
import { formatMonthLabel } from "@/lib/domain/month";
import type { LandingShowcase } from "@/lib/demo/landing";
import { CountUp } from "./count-up";
import { LandingSection } from "./landing-section";
import { Reveal } from "./reveal";

type BarStyle = CSSProperties & { "--bar-color"?: string };

function Tile({ id, title, tag, children }: { id: string; title: string; tag?: ReactNode; children: ReactNode }) {
  return <Reveal>
    <article aria-labelledby={id} className="rounded-md border border-line bg-bg p-6">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-sm font-semibold text-body">{title}</h3>
        {tag}
      </div>
      {children}
    </article>
  </Reveal>;
}

const proTag = <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-white">Pro</span>;

export function SpendTiles({ showcase }: { showcase: LandingShowcase }): JSX.Element {
  const month = formatMonthLabel(showcase.month, "short");
  const previousMonth = formatMonthLabel(showcase.previousMonth, "short");
  const increaseColorIndex = showcase.increase
    ? showcase.categoryBars.findIndex((bar) => bar.category === showcase.increase?.category)
    : -1;
  const increaseColor = increaseColorIndex < 0
    ? CHART_OTHER_COLOR
    : CHART_COLORS[increaseColorIndex % CHART_COLORS.length] ?? CHART_OTHER_COLOR;

  return <LandingSection id="tiles" tone="alt" labelledBy="tiles-heading">
    <p className="text-sm font-semibold text-accent">한 달 내역에서 찾아내는 것</p>
    <h2 id="tiles-heading" className="mt-2 text-2xl font-bold tracking-tight text-ink md:text-4xl">새는 돈이 숫자로 보여요</h2>
    <p className="mt-3 text-sm leading-relaxed text-body">아래는 예시예요. 내 파일을 올리면 내 숫자로 바뀌어요.</p>

    <div className="mt-8 grid gap-4 md:grid-cols-2">
      <Tile id="recurring-tile-title" title="잊고 있던 정기결제" tag={<span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-body">목록은 Pro</span>}>
        <p className="mt-2 flex items-baseline gap-2 text-4xl font-bold tracking-tight text-ink tabular-nums md:text-5xl"><span className="text-xl font-semibold text-body">월</span><CountUp value={showcase.recurring.monthlyTotal} format="krw" /></p>
        <p className="mt-1 text-sm text-muted">{showcase.recurring.count}건 · 1년이면 {formatKRW(showcase.recurring.yearlyTotal)}</p>
        <ul className="mt-5 grid gap-2">
          {showcase.recurring.items.map((item, index) => <li key={item.label} className="grid grid-cols-[72px_minmax(0,1fr)_76px] items-center gap-2.5 text-[13px] text-body">
            <span className="truncate">{item.label}</span>
            <span aria-hidden="true" className="h-2 overflow-hidden rounded-sm bg-line"><span className="block h-full origin-left rounded-sm bg-accent motion-safe:group-data-[in=true]:animate-landing-grow-x" style={{ width: `${item.width}%`, animationDelay: `${index * 0.05}s` }} /></span>
            <span className="text-right tabular-nums">{formatKRW(item.amount)}</span>
          </li>)}
        </ul>
      </Tile>

      {showcase.increase ? <Tile id="increase-tile-title" title="지난달보다 늘어난 지출" tag={proTag}>
        <p className="mt-2 flex items-baseline gap-2 text-4xl font-bold tracking-tight tabular-nums md:text-5xl"><span className="text-xl font-semibold text-body">{showcase.increase.category}</span><span className="text-spend-up"><CountUp value={showcase.increase.rate} format="signed-percent" /></span></p>
        <p className="mt-1 text-sm text-muted">{previousMonth} {formatKRW(showcase.increase.previous)} → {month} {formatKRW(showcase.increase.current)}</p>
        <div aria-hidden="true" className="mt-5 grid h-36 grid-cols-2 items-end gap-6 px-4">
          {[{ label: previousMonth, amount: showcase.increase.previous, current: false }, { label: month, amount: showcase.increase.current, current: true }].map((bar, index) => {
            const height = Math.max(2, Math.round(bar.amount / showcase.increase!.current * 100));
            const added = Math.max(0, Math.round((showcase.increase!.current - showcase.increase!.previous) / showcase.increase!.current * 100));
            return <div key={bar.label} className="grid h-full grid-rows-[1fr_auto_auto] text-center text-xs text-muted">
              <div className={`relative self-end overflow-hidden rounded-t-sm ${bar.current ? "bg-[var(--bar-color)]" : "bg-chart-muted"} origin-bottom motion-safe:group-data-[in=true]:animate-landing-grow-y`} style={{ height: `${height}%`, animationDelay: `${index * 0.05}s`, "--bar-color": increaseColor } as BarStyle}>{bar.current ? <span className="absolute inset-x-0 top-0 bg-spend-up" style={{ height: `${added}%` }} /> : null}</div>
              <span className="mt-2 font-semibold text-body">{bar.label}</span><span className="tabular-nums">{formatKRW(bar.amount)}</span>
            </div>;
          })}
        </div>
      </Tile> : null}

      <Tile id="weekend-tile-title" title="주말에 몰린 지출">
        <p className="mt-2 text-4xl font-bold tracking-tight text-ink tabular-nums md:text-5xl"><CountUp value={showcase.weekend.share} format="percent" /></p>
        <p className="mt-1 text-sm text-muted">토·일 이틀에 한 달 지출의 {showcase.weekend.share}%를 썼어요</p>
        <div aria-hidden="true" className="mt-5 grid h-32 grid-cols-7 items-end gap-2">
          {showcase.weekend.days.map((day, index) => <div key={day.label} className="grid h-full grid-rows-[1fr_auto] text-center text-xs text-muted">
            <span data-testid="weekday-bar" className={`self-end rounded-t-sm ${day.weekend ? "bg-accent" : "bg-chart-muted"} origin-bottom motion-safe:group-data-[in=true]:animate-landing-grow-y`} style={{ height: `${Math.max(2, day.height)}%`, animationDelay: `${index * 0.05}s` }} />
            <strong className={`mt-1.5 ${day.weekend ? "font-bold text-accent" : "font-normal"}`}>{day.label}</strong>
          </div>)}
        </div>
        <ul className="sr-only">{showcase.weekend.days.map((day) => <li key={day.label}>{day.label} {formatKRW(day.amount)}</li>)}</ul>
      </Tile>

      <Tile id="category-tile-title" title="가장 많이 쓴 카테고리">
        <p className="mt-2 flex items-baseline gap-2 text-4xl font-bold tracking-tight text-ink tabular-nums md:text-5xl"><span className="text-xl font-semibold text-body">{showcase.topCategory.category}</span><CountUp value={showcase.topCategory.share} format="percent" /></p>
        <p className="mt-1 text-sm text-muted">{month} 지출 {formatKRW(showcase.total)} 중 {formatKRW(showcase.topCategory.amount)}</p>
        <div aria-hidden="true" className="mt-5 flex h-[22px] gap-0.5 overflow-hidden rounded-sm">
          {showcase.categoryBars.map((bar, index) => <span key={bar.category} className="h-full origin-left bg-[var(--bar-color)] motion-safe:group-data-[in=true]:animate-landing-grow-x" style={{ width: `${bar.share}%`, animationDelay: `${index * 0.05}s`, "--bar-color": bar.category === "기타" ? CHART_OTHER_COLOR : CHART_COLORS[index % CHART_COLORS.length] } as BarStyle} />)}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-body">{showcase.categoryBars.map((bar, index) => {
          const color = bar.category === "기타" ? CHART_OTHER_COLOR : CHART_COLORS[index % CHART_COLORS.length];
          return <li key={bar.category} data-testid="category-legend-item" className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-sm bg-[var(--bar-color)]" style={{ "--bar-color": color } as BarStyle} />{bar.category} {bar.share}%</li>;
        })}</ul>
      </Tile>
    </div>
  </LandingSection>;
}
