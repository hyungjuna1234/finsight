import { CATEGORIES } from "@/lib/domain/categories";
import type { TxFilters } from "@/lib/domain/tx-filters";
import type { YearMonth } from "@/lib/domain/types";
import { MonthPicker } from "./month-picker";

export function TxFiltersForm({ month, availableMonths, filters, cards }: { month: YearMonth; availableMonths: YearMonth[]; filters: TxFilters; cards: { id: string; name: string }[] }) {
  return <div className="space-y-4"><MonthPicker month={month} availableMonths={availableMonths} basePath="/transactions" /><form aria-label="거래 필터" method="get" action="/transactions" className="grid gap-3 sm:grid-cols-4">
    <input type="hidden" name="month" value={month} />
    <label className="text-sm text-muted">카테고리<select aria-label="카테고리" name="category" defaultValue={filters.category ?? ""} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink"><option value="">전체</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label className="text-sm text-muted">카드<select aria-label="카드" name="cardId" defaultValue={filters.cardId ?? ""} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink"><option value="">전체</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}</select></label>
    <label className="text-sm text-muted">가맹점 검색<input aria-label="가맹점 검색" name="q" maxLength={50} defaultValue={filters.q ?? ""} className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink" /></label>
    <button className="self-end rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">검색</button>
  </form></div>;
}
