import Link from "next/link";

export function ProLock({ message = "Pro에서 전체 목록을 볼 수 있어요" }: { message?: string }) {
  return <div className="mt-3 flex flex-wrap items-center gap-3 text-left"><p className="text-sm text-body">{message}</p><Link href="/pricing" className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">Pro 시작하기</Link></div>;
}
