"use client";

import { useState } from "react";
import { apiFetch } from "@/components/ui/api-fetch";
import type { ErrorCode } from "@/lib/domain/errors";

interface TypedConfirmProps {
  phrase: string; title: string; description: React.ReactNode; submitLabel: string;
  endpoint: `/api/${string}`; redirectTo: string;
  errorMessages?: Partial<Record<ErrorCode, string>>;
  tone?: "default" | "danger";
}

function errorCode(error: unknown): ErrorCode | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code as ErrorCode : null;
}

export function TypedConfirm({ phrase, title, description, submitLabel, endpoint, redirectTo, errorMessages, tone = "default" }: TypedConfirmProps) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (value !== phrase || pending) return;
    setPending(true); setError(null);
    try { await apiFetch(endpoint, { method: "POST", body: { confirm: phrase } }); window.location.assign(redirectTo); }
    catch (caught) {
      const code = errorCode(caught);
      setError(code === null ? "처리하지 못했어요. 잠시 후 다시 시도해 주세요." : errorMessages?.[code] ?? "처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setPending(false);
    }
  }
  return <section className="space-y-3">
    <div><h2 className="text-base font-semibold text-ink">{title}</h2><div className="mt-1 text-sm leading-relaxed text-body">{description}</div></div>
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm text-body"><span className="mb-1 block"><strong>{phrase}</strong>를 입력해 주세요.</span><input value={value} onChange={(event) => setValue(event.target.value)} className="w-full max-w-sm rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:ring-2 focus:ring-accent/30 focus:outline-none" /></label>
      {error ? <p role="alert" className="text-sm text-warning">{error}</p> : null}
      <button type="submit" disabled={value !== phrase || pending} className={`rounded-md border border-line bg-surface px-4 py-2.5 text-sm hover:bg-bg disabled:text-disabled ${tone === "danger" ? "text-spend-up" : "text-ink"}`}>{pending ? "삭제 중" : submitLabel}</button>
    </form>
  </section>;
}
