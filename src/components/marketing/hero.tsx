import Link from "next/link";

export function Hero() {
  return <section aria-labelledby="hero-heading" className="py-8 sm:py-14">
    <div className="max-w-3xl">
      <h1 id="hero-heading" className="text-4xl font-semibold tracking-tight text-ink">카드 이용내역 파일만 올리면, 한 달 지출이 정리돼요</h1>
      <p className="mt-4 text-base leading-relaxed text-body">연동 없이 카드사 홈페이지에서 받은 파일만 올려요.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/login?next=%2Fupload" className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">무료로 시작</Link>
        <Link href="/demo" className="rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-bg">예시 보기</Link>
      </div>
    </div>
  </section>;
}
