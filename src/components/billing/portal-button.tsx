"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, apiFetch } from "@/components/ui/api-fetch";

export function PortalButton({ label = "구독 관리" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);
  const [failed, setFailed] = useState(false);
  async function open() {
    if (busy) return;
    setBusy(true); setMissing(false); setFailed(false);
    try {
      const { url } = await apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
      window.location.assign(url);
    } catch (error) {
      if (error instanceof ApiError && error.code === "NOT_FOUND") setMissing(true);
      else setFailed(true);
    } finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={open} className="rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink hover:bg-bg disabled:text-disabled">{busy ? "구독 정보를 열고 있어요" : label}</button>{missing ? <p role="alert" className="mt-2 text-sm text-warning">구독 기록이 없어요. <Link href="/pricing" className="underline">Pro 보기</Link></p> : null}{failed ? <p role="alert" className="mt-2 text-sm text-warning">구독 정보를 열지 못했어요. 잠시 후 다시 시도해 주세요.</p> : null}</div>;
}
