import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/domain/legal";

const links = [
  { href: "/privacy", label: "개인정보 처리방침" },
  { href: "/terms", label: "이용약관" },
  { href: "/refund", label: "환불 정책" },
  { href: "/guide", label: "가이드" },
] as const;

export function SiteFooter() {
  return <footer className="mt-auto border-t border-line bg-surface">
    <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-8">
      <nav aria-label="정책 및 도움말"><ul className="flex flex-wrap gap-x-4 gap-y-2">{links.map((link) => <li key={link.href}><Link href={link.href} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">{link.label}</Link></li>)}</ul></nav>
      <p className="text-sm leading-relaxed text-muted">지출 정리를 돕는 서비스예요. 재무·투자·세무 조언을 하지 않아요.</p>
      <p className="text-xs leading-relaxed text-muted">{BUSINESS_INFO.name} · 대표자 {BUSINESS_INFO.owner} · 사업자등록번호 {BUSINESS_INFO.registrationNo} · 통신판매업 신고번호 {BUSINESS_INFO.mailOrderNo} · {BUSINESS_INFO.email}</p>
    </div>
  </footer>;
}
