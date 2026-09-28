"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/domain/categories";
import { ApiError, apiFetch, redirectPathForError } from "@/components/ui/api-fetch";
import { trackEvent } from "@/components/ui/track";

export function CategorySheet({ tx, onClose }: { tx: { id: string; merchantRaw: string; category: Category }; onClose: () => void }) {
  const [category, setCategory] = useState(tx.category); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  async function submit(scope: "one" | "merchant") { setBusy(true); setMessage(""); try { const result = await apiFetch<{ updated: number }>(`/api/transactions/${tx.id}`, { method: "PATCH", body: { category, scope } }); setMessage(scope === "one" ? "분류를 바꿨어요" : `같은 가맹점 ${result.updated}건을 바꿨어요`); trackEvent("category_edit", { scope }); router.refresh(); } catch (error) { if (error instanceof ApiError) { const path = redirectPathForError(error.code, "/transactions"); if (path) router.push(path); else setMessage(error.message); } else setMessage("잠시 후 다시 시도해 주세요."); } finally { setBusy(false); } }
  return <div role="dialog" aria-modal="true" aria-label={`${tx.merchantRaw} 분류 변경`} className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface p-5 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96 sm:rounded-md sm:border">
    <div className="flex justify-between"><h2 className="font-semibold text-ink">분류 바꾸기</h2><button onClick={onClose} className="text-sm text-muted">닫기</button></div><p className="mt-1 truncate text-sm text-body">{tx.merchantRaw}</p>
    <div className="my-4 flex flex-wrap gap-2">{CATEGORIES.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className="rounded-md border border-line px-3 py-2 text-sm aria-pressed:border-accent aria-pressed:text-accent">{item}</button>)}</div>
    <div className="flex gap-2"><button disabled={busy} onClick={() => void submit("one")} className="rounded-md border border-line px-4 py-2.5 text-sm">이번 건만</button><button disabled={busy} onClick={() => void submit("merchant")} className="rounded-md bg-accent px-4 py-2.5 text-sm text-white">같은 가맹점 모두</button></div>
    {message ? <p role="status" className="mt-3 text-sm text-body">{message}</p> : null}
  </div>;
}
