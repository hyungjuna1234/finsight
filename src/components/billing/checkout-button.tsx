"use client";

import { track } from "@vercel/analytics";
import { useState } from "react";
import { ApiError, apiFetch, redirectPathForError } from "@/components/ui/api-fetch";

async function goToPortal(): Promise<void> {
  const { url } = await apiFetch<{ url: string }>("/api/billing/portal", { method: "POST" });
  window.location.assign(url);
}

export function CheckoutButton({ returnTo }: { returnTo?: string }) {
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  async function checkout() {
    if (busy) return;
    setBusy(true); setUnavailable(false); track("checkout_start");
    try {
      const { url } = await apiFetch<{ url: string }>("/api/billing/checkout", { method: "POST", body: returnTo ? { returnTo } : {} });
      window.location.assign(url);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "ALREADY_SUBSCRIBED") {
          try { await goToPortal(); return; } catch { setUnavailable(true); }
        } else {
          const path = redirectPathForError(error.code, "/pricing");
          if (path) { window.location.assign(path); return; }
          if (error.code === "BILLING_UNAVAILABLE") setUnavailable(true);
        }
      } else setUnavailable(true);
    } finally { setBusy(false); }
  }

  return <div><button type="button" disabled={busy} onClick={checkout} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover disabled:bg-disabled">{busy ? "결제 페이지를 열고 있어요" : "Pro 시작하기"}</button>{unavailable ? <p role="alert" className="mt-2 text-sm text-warning">결제 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요. <button type="button" onClick={checkout} className="underline">다시 시도</button></p> : null}</div>;
}
