const points = [
  "연동 없음 · 카드사에서 받은 파일만 올려요",
  "원본은 90일 후 자동 삭제 · 언제든 전부 삭제할 수 있어요",
  "AI에는 가맹점명과 집계값만 보내요 · 카드번호는 보내지 않아요",
] as const;

export function TrustPoints() {
  return <section aria-labelledby="trust-heading" className="border-y border-line py-6">
    <h2 id="trust-heading" className="text-base font-semibold text-ink">데이터는 필요한 만큼만 다뤄요</h2>
    <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-body md:grid-cols-3">{points.map((point) => <li key={point} className="border-l-2 border-line pl-3">{point}</li>)}</ul>
  </section>;
}
