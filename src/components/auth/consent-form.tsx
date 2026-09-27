"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { apiFetch } from "@/components/ui/api-fetch";
import type { ConsentKind } from "@/lib/domain/consent";

interface ConsentItem {
  kind: ConsentKind;
  label: string;
  summary: string;
  href?: string;
}

export function ConsentForm({ items }: { items: readonly ConsentItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ConsentKind[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allSelected = selected.length === items.length;

  function toggle(kind: ConsentKind, checked: boolean) {
    setSelected((current) => checked ? [...current, kind] : current.filter((item) => item !== kind));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allSelected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<void>("/api/consents", { method: "POST", body: { kinds: selected } });
      router.push("/upload");
    } catch {
      setError("동의를 저장하지 못했어요. 다시 시도해 주세요.");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-6" onSubmit={submit}>
        <label className="flex items-center gap-3 border-b border-line pb-4 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(event) => setSelected(event.target.checked ? items.map(({ kind }) => kind) : [])}
            className="size-4 accent-accent"
          />
          모두 동의
        </label>
        <div className="space-y-4">
          {items.map((item) => (
            <label key={item.kind} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.includes(item.kind)}
                onChange={(event) => toggle(item.kind, event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              <span>
                <span className="text-sm font-medium text-ink">
                  {item.label}
                  {item.href ? <a href={item.href} className="ml-2 text-muted underline underline-offset-4">자세히</a> : null}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-body">{item.summary}</span>
              </span>
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <button type="submit" disabled={!allSelected || submitting} className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:bg-disabled">시작하기</button>
          {!allSelected ? <p className="text-sm text-muted">필수 항목에 모두 동의해야 이용할 수 있어요.</p> : null}
          {error ? <p role="alert" className="text-sm text-warning">{error}</p> : null}
        </div>
      </form>
      <form action="/auth/signout" method="post" className="border-t border-line pt-4">
        <button type="submit" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">동의하지 않고 나가기</button>
      </form>
    </div>
  );
}
