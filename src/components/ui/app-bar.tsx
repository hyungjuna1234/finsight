"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { clearChatStorage } from "@/components/chat/chat-storage";

const links = [
  ["대시보드", "/dashboard"], ["거래", "/transactions"], ["업로드", "/upload"], ["추이", "/trends"],
  ["정기결제", "/recurring"], ["인사이트", "/insights"], ["채팅", "/chat"], ["설정", "/settings"],
] as const;

export function AppBar() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-5 px-4">
        <Link href="/dashboard" className="shrink-0 text-base font-semibold text-ink">FinSight</Link>
        <nav aria-label="앱 메뉴" className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto py-3 text-sm whitespace-nowrap">
          {links.map(([label, href]) => <Link key={href} href={href} aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined} className="text-muted hover:text-ink aria-[current=page]:font-medium aria-[current=page]:text-accent">{label}</Link>)}
        </nav>
        <form method="post" action="/auth/signout" onSubmit={clearChatStorage} className="shrink-0"><button type="submit" className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">로그아웃</button></form>
      </div>
    </header>
  );
}
