"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "@/components/ui/api-fetch";
import type { Plan } from "@/lib/domain/types";

type CheckoutState = "open" | "expired" | "confirmed" | "succeeded" | "failed";
type ViewState = "checking" | "pro" | "incomplete" | "delayed" | "invalid";
const RETRY_DELAYS = [2000, 4000, 6000, 8000, 10000] as const;

export function CheckoutStatus({ checkoutId, next }: { checkoutId: string | null; next: string }) {
  const [view, setView] = useState<ViewState>(checkoutId ? "checking" : "invalid");
  const started = useRef(false);
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tracked = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const cleanup = () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); };
    if (!checkoutId || started.current) return cleanup;
    started.current = true;

    async function confirm(retry: number): Promise<void> {
      try {
        const result = await apiFetch<{ plan: Plan; checkout: CheckoutState }>("/api/billing/confirm", { method: "POST", body: { checkoutId } });
        if (!mounted.current) return;
        if (result.plan === "pro") { setView("pro"); return; }
        if (result.checkout === "open" || result.checkout === "expired" || result.checkout === "failed") { setView("incomplete"); return; }
        const delay = RETRY_DELAYS[retry];
        if (delay === undefined) { setView("delayed"); return; }
        timer.current = setTimeout(() => { void confirm(retry + 1); }, delay);
      } catch (error) {
        if (mounted.current) setView(error instanceof ApiError && (error.code === "FORBIDDEN" || error.code === "NOT_FOUND") ? "invalid" : "invalid");
      }
    }
    void confirm(0);
    return cleanup;
  }, [checkoutId]);

  useEffect(() => {
    if (view === "pro" && !tracked.current) { tracked.current = true; track("checkout_pro_active"); }
  }, [view]);

  if (view === "checking") return <p className="text-sm text-body">결제를 확인하고 있어요</p>;
  if (view === "pro") return <div className="space-y-3"><p className="text-base font-semibold text-ink">Pro가 열렸어요</p><Link href={next} className="inline-block rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">계속하기</Link></div>;
  if (view === "incomplete") return <div className="space-y-3"><p className="text-sm text-body">결제가 완료되지 않았어요</p><Link href="/pricing?checkout=failed" className="text-sm text-accent underline-offset-4 hover:underline">요금 페이지로</Link></div>;
  if (view === "delayed") return <div className="space-y-3"><p className="text-sm text-body">결제는 완료됐어요. Pro 적용까지 몇 분 걸릴 수 있어요.</p><Link href="/dashboard" className="text-sm text-accent underline-offset-4 hover:underline">대시보드로</Link></div>;
  return <p className="text-sm text-warning">결제 정보를 확인할 수 없어요</p>;
}
