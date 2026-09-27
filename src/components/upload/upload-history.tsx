"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/components/ui/api-fetch";
import type { IsoDate } from "@/lib/domain/types";

export interface UploadHistoryItem {
  id: string; filename: string; status: "uploaded" | "awaiting_confirm" | "done" | "failed"; createdAt: string;
  periodFrom: IsoDate | null; periodTo: IsoDate | null; inserted: number | null; cardName: string | null; originalDeleted: boolean;
}

const STATUS: Record<UploadHistoryItem["status"], string> = { uploaded: "업로드됨", awaiting_confirm: "확인 필요", done: "완료", failed: "실패" };
function period(from: UploadHistoryItem["periodFrom"], to: UploadHistoryItem["periodTo"]): string {
  if (!from || !to) return "기간 없음";
  return `${from.replaceAll("-", ".")} ~ ${from.slice(0, 4) === to.slice(0, 4) ? to.slice(5).replace("-", ".") : to.replaceAll("-", ".")}`;
}

export function UploadHistory({ uploads }: { uploads: UploadHistoryItem[] }) {
  const router = useRouter(); const [confirming, setConfirming] = useState<string | null>(null); const [deleting, setDeleting] = useState<string | null>(null); const [toast, setToast] = useState(false);
  if (!uploads.length) return <p className="text-sm text-body">올린 파일이 없어요 <Link href="/upload" className="text-accent underline-offset-4 hover:underline">업로드</Link></p>;
  async function remove(id: string) { setDeleting(id); try { await apiFetch(`/api/uploads/${id}`, { method: "DELETE" }); setConfirming(null); setToast(true); router.refresh(); } finally { setDeleting(null); } }
  return <div className="space-y-3">{toast ? <p role="status" className="text-sm text-accent">삭제했어요</p> : null}<ul className="divide-y divide-line border-y border-line">{uploads.map((upload) => <li key={upload.id} className="py-4 text-sm">
    <div className="flex items-start justify-between gap-4"><div className="min-w-0 space-y-1"><p className="truncate font-medium text-ink">{upload.filename}</p><p className="text-muted tabular-nums">{upload.cardName ?? "카드 없음"} · {period(upload.periodFrom, upload.periodTo)} · {upload.inserted === null ? "추가 건수 없음" : `${upload.inserted}건 추가`} · {STATUS[upload.status]}</p><p className="text-muted">{upload.originalDeleted ? "원본 삭제됨" : "원본 보관 중(90일 후 자동 삭제)"}</p></div><button type="button" onClick={() => setConfirming(upload.id)} className="shrink-0 text-sm text-muted underline-offset-4 hover:text-ink hover:underline">삭제</button></div>
    {confirming === upload.id ? <div className="mt-3 space-y-3 border-t border-line pt-3"><p className="text-sm leading-relaxed text-body">이 파일로 들어온 거래가 지워져요. 기간이 겹치는 다른 파일에도 있던 거래도 함께 빠질 수 있어요. 그 파일을 다시 올리면 복구돼요.</p><div className="flex gap-3"><button type="button" disabled={deleting === upload.id} onClick={() => void remove(upload.id)} className="rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink hover:bg-bg disabled:text-disabled">삭제할게요</button><button type="button" onClick={() => setConfirming(null)} className="text-sm text-muted hover:text-ink">취소</button></div></div> : null}
  </li>)}</ul></div>;
}
