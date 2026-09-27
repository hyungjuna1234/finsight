import Link from "next/link";

export function HowItWorks() {
  return <section aria-labelledby="how-heading">
    <h2 id="how-heading" className="text-base font-semibold text-ink">이렇게 정리해요</h2>
    <ol className="mt-4 grid gap-4 md:grid-cols-3">
      <li className="border-t border-line pt-4"><p className="text-sm font-medium tabular-nums text-muted">01</p><p className="mt-2 text-sm leading-relaxed text-body">카드사 홈페이지에서 &apos;이용내역&apos;을 엑셀로 받아요 — <Link href="/guide" className="text-accent underline-offset-4 hover:underline">받는 법</Link></p></li>
      <li className="border-t border-line pt-4"><p className="text-sm font-medium tabular-nums text-muted">02</p><p className="mt-2 text-sm leading-relaxed text-body">파일을 올리면 열을 맞추고 카테고리를 자동으로 나눠요</p></li>
      <li className="border-t border-line pt-4"><p className="text-sm font-medium tabular-nums text-muted">03</p><p className="mt-2 text-sm leading-relaxed text-body">한 달 총지출, 카테고리, 많이 쓴 곳 TOP5를 바로 봐요</p></li>
    </ol>
  </section>;
}
