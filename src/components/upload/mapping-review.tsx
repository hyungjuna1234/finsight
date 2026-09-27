"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { CardChoice, UploadPreview } from "@/lib/domain/upload";
import type { ColumnMapping } from "@/lib/ingest/mapping";
import { CardField } from "./card-field";

const OPTIONAL = [["approvalNo", "승인번호"], ["installment", "할부"], ["cancelFlag", "취소/상태"], ["foreignAmount", "해외금액"], ["foreignCurrency", "통화"], ["cardNumber", "카드번호"]] as const;
type ColumnKey = keyof ColumnMapping["columns"];

export function MappingReview({ preview, mapping, cards, defaultCard, submitting, onSubmit }: { preview: UploadPreview; mapping: ColumnMapping | null; cards: { id: string; name: string }[]; defaultCard?: CardChoice; submitting: boolean; onSubmit(mapping: ColumnMapping, card: CardChoice): void }) {
  const [headerRowIndex, setHeaderRowIndex] = useState(mapping?.headerRowIndex ?? preview.headerRowIndex);
  const [columns, setColumns] = useState<ColumnMapping["columns"]>(mapping?.columns ?? { date: 0, merchant: 1, amount: 2 });
  const [card, setCard] = useState<CardChoice | null>(defaultCard ?? (cards[0] ? { id: cards[0].id } : { name: "" }));
  const [more, setMore] = useState(false);
  const headers = preview.rows[headerRowIndex] ?? [];
  useEffect(() => {
    setColumns((current) => {
      const valid = (index: number | undefined) => index !== undefined && index < headers.length ? index : undefined;
      return { date: valid(current.date) ?? 0, merchant: valid(current.merchant) ?? Math.min(1, Math.max(0, headers.length - 1)), amount: valid(current.amount) ?? Math.min(2, Math.max(0, headers.length - 1)) };
    });
  }, [headerRowIndex, headers.length]);
  const option = (value: number) => headers[value] || `열 ${value + 1}`;
  const select = (key: ColumnKey, label: string, optional = false) => <label className="text-sm font-medium text-ink">{label} 열
    <select aria-label={`${label} 열`} value={columns[key] ?? ""} onChange={(event) => setColumns({ ...columns, [key]: event.target.value === "" ? undefined : Number(event.target.value) })} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink">
      {optional ? <option value="">없음</option> : null}{headers.map((_, index) => <option key={index} value={index}>{option(index)}</option>)}
    </select>
  </label>;
  const requiredDistinct = new Set([columns.date, columns.merchant, columns.amount]).size === 3;
  const cardValid = card && ("id" in card || card.name.trim().length >= 1 && card.name.trim().length <= 30);
  function submit(event: FormEvent) { event.preventDefault(); if (requiredDistinct && cardValid) onSubmit({ headerRowIndex, columns }, "name" in card! ? { name: card.name.trim() } : card!); }
  const highlighted = new Set(Object.values(columns).filter((v): v is number => v !== undefined));
  return <form onSubmit={submit} className="space-y-5">
    <p className="text-sm leading-relaxed text-body">열 이름이 맞는지 확인해 주세요. 한 번 저장하면 같은 형식은 다음부터 바로 올라가요.</p>
    <label className="block text-sm font-medium text-ink">헤더 행
      <select aria-label="헤더 행" value={headerRowIndex} onChange={(event) => setHeaderRowIndex(Number(event.target.value))} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink">
        {preview.rows.slice(0, 30).map((row, index) => <option key={index} value={index}>{index + 1}행 · {row.slice(0, 3).join(" · ")}</option>)}
      </select>
    </label>
    <div className="grid gap-3 sm:grid-cols-3">{select("date", "날짜")}{select("merchant", "가맹점")}{select("amount", "금액")}</div>
    <button type="button" onClick={() => setMore(!more)} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">{more ? "접기" : "더 보기"}</button>
    {more ? <div className="grid gap-3 sm:grid-cols-3">{OPTIONAL.map(([key, label]) => <div key={key}>{select(key, label, true)}</div>)}</div> : null}
    <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><tbody>{preview.rows.slice(headerRowIndex + 1, headerRowIndex + 6).map((row, r) => <tr key={r} data-testid="preview-row" className="border-b border-line">{row.map((cell, c) => <td key={c} className={`px-2 py-2 ${highlighted.has(c) ? "bg-accent-soft text-ink" : "text-body"}`}>{cell}</td>)}</tr>)}</tbody></table></div>
    <CardField cards={cards} value={card} onChange={setCard} disabled={submitting} />
    <button type="submit" disabled={!requiredDistinct || !cardValid || submitting} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:bg-disabled">저장하고 분석</button>
  </form>;
}
