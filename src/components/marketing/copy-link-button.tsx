"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/components/ui/track";

export function CopyLinkButton({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fallbackUrl) inputRef.current?.select();
  }, [fallbackUrl]);

  async function copyLink() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (!navigator.clipboard) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(url);
      trackEvent("link_copy", {});
      setCopied(true);
      setFallbackUrl(null);
    } catch {
      setCopied(false);
      setFallbackUrl(url);
    }
  }

  return <div className="space-y-2">
    <button type="button" onClick={copyLink} className="rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink hover:bg-bg">{label}</button>
    {copied ? <p role="status" className="text-sm text-body">링크를 복사했어요</p> : null}
    {fallbackUrl ? <input ref={inputRef} aria-label="복사할 링크" readOnly value={fallbackUrl} className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/30" /> : null}
  </div>;
}
