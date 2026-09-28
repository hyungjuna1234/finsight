import { TrackedLink } from "@/components/ui/tracked-link";

export function DemoBanner() {
  return <aside className="flex flex-col items-start justify-between gap-3 border-b border-line bg-accent-soft px-4 py-4 sm:flex-row sm:items-center">
    <p className="text-sm text-body">샘플 데이터예요 · 실제 화면과 같아요</p>
    <TrackedLink href="/login?next=%2Fupload" event="demo_cta" eventProps={{}} className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-hover">내 데이터로 시작</TrackedLink>
  </aside>;
}
