import Link from "next/link";

const links = [
  { href: "/pricing", label: "요금" },
  { href: "/guide", label: "가이드" },
  { href: "/login", label: "로그인" },
] as const;

export function SiteHeader() {
  return <header className="border-b border-line bg-surface">
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
      <Link href="/" className="text-base font-semibold text-ink">FinSight</Link>
      <nav aria-label="주요 메뉴"><ul className="flex items-center gap-4">{links.map((link) => <li key={link.href}><Link href={link.href} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">{link.label}</Link></li>)}</ul></nav>
    </div>
  </header>;
}
