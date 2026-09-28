import type { CSSProperties } from "react";
import { CATEGORIES, type Category } from "@/lib/domain/categories";
import { CHART_COLORS, CHART_OTHER_COLOR } from "@/lib/domain/chart-colors";
import { formatKRW } from "@/lib/domain/money";
import type { KRW, YearMonth } from "@/lib/domain/types";
import type { LandingCategoryBar, LandingSheetRow, LandingShowcase } from "@/lib/demo/landing";

type ColorStyle = CSSProperties & { "--c": string };

const rawAmountFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

function colorForCategory(category: Category, bars: LandingCategoryBar[]): string {
  if (category === "기타") return CHART_OTHER_COLOR;
  const barIndex = bars.findIndex((bar) => bar.category === category);
  const fallbackIndex = CATEGORIES.indexOf(category);
  return CHART_COLORS[(barIndex >= 0 ? barIndex : fallbackIndex) % CHART_COLORS.length] ?? CHART_OTHER_COLOR;
}

export function HeroStage({ month, total, count, rows, bars, insight }: {
  month: YearMonth;
  total: KRW;
  count: number;
  rows: LandingSheetRow[];
  bars: LandingCategoryBar[];
  insight: { headline: string; increase: LandingShowcase["increase"] };
}) {
  const monthNumber = Number(month.slice(5));

  return <figure aria-label="이용내역 파일이 AI 리포트로 바뀌는 과정 예시" className="grid gap-2.5">
    <div className="overflow-hidden rounded-md border border-line bg-surface shadow-[0_18px_40px_-28px_rgba(24,32,28,0.45)]">
      <div className="flex items-center gap-2 border-b border-line bg-[#FAFBFA] px-3 py-2 text-xs text-body">
        <svg className="size-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><path d="M14 3v5h5M8 12h8M8 16h8M12 12v6" /></svg>
        카드이용내역_{month}.xlsx
      </div>
      <table className="w-full table-fixed border-collapse text-[13px]">
        <colgroup><col className="w-[9%]" /><col className="w-[15%]" /><col className="w-[27%]" /><col className="w-[20%]" /><col className="w-[29%]" /></colgroup>
        <thead><tr>{["", "A", "B", "C", "D"].map((label, index) => <th key={`${label}-${index}`} className="h-[22px] border-r border-b border-line bg-[#F1F3F1] text-[11px] font-medium text-muted last:border-r-0">{label}</th>)}</tr></thead>
        <tbody>
          <tr className="bg-[#FAFBFA] text-xs font-semibold"><td className="h-[30px] border-r border-b border-line bg-[#F1F3F1] text-center text-[11px] font-normal text-muted">1</td><td className="h-[30px] border-r border-b border-line px-2">이용일</td><td className="h-[30px] border-r border-b border-line px-2">가맹점</td><td className="h-[30px] border-r border-b border-line px-2 text-right">이용금액</td><td className="h-[30px] border-b border-line px-2 text-accent">AI 분류</td></tr>
          {rows.map((row, index) => {
            const chipColor = colorForCategory(row.category, bars);
            return <tr key={`${row.date}-${row.merchant}-${index}`} data-testid="sheet-data-row" className="motion-safe:animate-landing-fade" style={{ animationDelay: `${0.1 + index * 0.06}s` }}>
              <td className="h-[30px] border-r border-b border-line bg-[#F1F3F1] text-center text-[11px] text-muted">{index + 2}</td>
              <td className="h-[30px] truncate border-r border-b border-line px-2 tabular-nums">{row.date}</td>
              <td className="h-[30px] truncate border-r border-b border-line px-2">{row.merchant}</td>
              <td className="h-[30px] truncate border-r border-b border-line px-2 text-right tabular-nums">{rawAmountFormatter.format(row.amount)}</td>
              <td className="h-[30px] truncate border-b border-line px-2 motion-safe:animate-landing-select" style={{ animationDelay: `${1 + index * 0.2}s` }}>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold motion-safe:animate-landing-pop [background:color-mix(in_srgb,var(--c)_15%,white)] [color:color-mix(in_srgb,var(--c)_60%,var(--ink))]" style={{ "--c": chipColor, animationDelay: `${1.05 + index * 0.2}s` } as ColorStyle}><span className="size-1.5 rounded-full bg-[var(--c)]" aria-hidden="true" />{row.category}</span>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    <p className="flex items-center gap-2 pl-1 text-xs text-muted motion-safe:animate-landing-fade" style={{ animationDelay: "2.2s" }}><svg className="size-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>카테고리별로 모아요 · {monthNumber}월 {count}건</p>
    <div className="rounded-md border border-line bg-surface p-4 motion-safe:animate-landing-fade" style={{ animationDelay: "2.3s" }}>
      <div className="flex items-baseline justify-between gap-3 text-sm text-muted"><span>{monthNumber}월 지출</span><strong className="text-xl font-bold text-ink tabular-nums">{formatKRW(total)}</strong></div>
      <ul className="mt-2 grid gap-1">{bars.map((bar, index) => {
        const color = bar.category === "기타" ? CHART_OTHER_COLOR : CHART_COLORS[index % CHART_COLORS.length] ?? CHART_OTHER_COLOR;
        return <li key={bar.category} data-testid="category-bar" className="grid grid-cols-[78px_minmax(0,1fr)_36px] items-center gap-2.5 text-xs text-body"><span className="truncate">{bar.category}</span><span className="h-2.5 overflow-hidden rounded-sm bg-[#EEF1EF]"><span className="block h-full origin-left rounded-sm bg-[var(--c)] motion-safe:animate-landing-grow-x" style={{ "--c": color, width: `${bar.width}%`, animationDelay: `${2.45 + index * 0.07}s` } as ColorStyle} /></span><span className="text-right tabular-nums">{bar.share}%</span></li>;
      })}</ul>
    </div>
    <div className="grid gap-2 rounded-md bg-ink p-4 text-white motion-safe:animate-landing-rise" style={{ animationDelay: "3.2s" }}>
      <p className="flex justify-between text-xs font-semibold tracking-wide text-white/70"><span>AI 리포트</span><span>예시</span></p>
      <p className="text-[17px] font-semibold leading-[1.45]">{insight.headline}</p>
      {insight.increase ? <p className="flex items-baseline gap-2.5"><strong className="text-3xl font-bold text-up-on-dark tabular-nums">▲ {insight.increase.rate}%</strong><span className="text-sm text-white/80">{insight.increase.category} · 지난달보다</span></p> : null}
    </div>
    <figcaption className="pl-1 text-xs text-muted">예시 데이터로 만든 화면이에요</figcaption>
  </figure>;
}
