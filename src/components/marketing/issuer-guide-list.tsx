import type { IssuerGuide } from "@/lib/domain/guides";

export function IssuerGuideList({ guides }: { guides: readonly IssuerGuide[] }) {
  return <div>
    <p className="text-sm leading-relaxed text-muted">메뉴 위치는 카드사 사정에 따라 바뀔 수 있어요.</p>
    <div className="mt-3 border-t border-line">
      {guides.map((guide) => <details key={guide.id} className="border-b border-line py-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">{guide.name}</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-body">
          {guide.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        {guide.note ? <p className="mt-3 text-sm leading-relaxed text-muted">{guide.note}</p> : null}
        {guide.verifiedAt ? <p className="mt-3 text-xs tabular-nums text-muted">마지막 확인 {guide.verifiedAt}</p> : null}
      </details>)}
    </div>
  </div>;
}
