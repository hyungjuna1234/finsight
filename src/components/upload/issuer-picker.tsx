"use client";

import { useState, type JSX } from "react";
import { trackEvent } from "@/components/ui/track";
import type { IssuerGuide, IssuerId } from "@/lib/domain/guides";

export function IssuerPicker({ guides }: { guides: readonly IssuerGuide[] }): JSX.Element {
  const [selected, setSelected] = useState<IssuerId | null>(null);
  const activeGuide = guides.find((guide) => guide.id === selected);

  function toggle(guide: IssuerGuide) {
    if (selected === guide.id) {
      setSelected(null);
      return;
    }
    setSelected(guide.id);
    trackEvent("guide_open", { issuer: guide.id, where: "upload" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {guides.map((guide) => (
          <button
            key={guide.id}
            type="button"
            aria-pressed={selected === guide.id}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-bg"
            onClick={() => toggle(guide)}
          >
            {guide.name}
          </button>
        ))}
      </div>
      {activeGuide ? (
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-body">
          {activeGuide.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      ) : null}
      <a href="/guide" className="inline-block text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
        카드사별 자세히 보기
      </a>
    </div>
  );
}
