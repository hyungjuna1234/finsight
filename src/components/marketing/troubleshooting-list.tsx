import { troubleAnchor, type TroubleItem } from "@/lib/domain/guides";

export function TroubleshootingList({ items }: { items: readonly TroubleItem[] }) {
  return <div className="border-t border-line">
    {items.map((item) => <article key={item.code} className="scroll-mt-4 border-b border-line py-4">
      <h3 id={troubleAnchor(item.code)} className="text-sm font-medium text-ink">{item.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-body">{item.fix}</p>
    </article>)}
  </div>;
}
