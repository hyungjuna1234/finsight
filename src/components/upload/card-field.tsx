"use client";

import type { CardChoice } from "@/lib/domain/upload";

export function CardField({ cards, value, onChange, disabled = false }: { cards: { id: string; name: string }[]; value: CardChoice | null; onChange(value: CardChoice | null): void; disabled?: boolean }) {
  const existing = value && "id" in value ? value.id : "new";
  const name = value && "name" in value ? value.name : "";
  return <div className="grid gap-3 sm:grid-cols-2">
    {cards.length ? <label className="text-sm font-medium text-ink">카드
      <select aria-label="카드" value={existing} disabled={disabled} onChange={(event) => onChange(event.target.value === "new" ? { name: "" } : { id: event.target.value })} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink">
        {cards.map((card) => <option key={card.id} value={card.id}>{card.name}</option>)}<option value="new">새 카드</option>
      </select>
    </label> : null}
    {(!cards.length || existing === "new") ? <label className="text-sm font-medium text-ink">새 카드 이름
      <input aria-label="새 카드 이름" value={name} maxLength={30} disabled={disabled} placeholder="예: 신한 체크" onChange={(event) => onChange({ name: event.target.value })} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30" />
    </label> : null}
  </div>;
}
