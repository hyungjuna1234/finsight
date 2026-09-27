import { notFound, redirect } from "next/navigation";
import { UploadReview } from "@/components/upload/upload-review";
import { safeRedirect } from "@/lib/domain/redirect";
import { getUploadReview } from "@/server/queries/uploads";

export default async function UploadReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getUploadReview(id);
  if (!data) notFound();
  if (data.upload.status === "done") redirect(safeRedirect("/dashboard"));
  return <main className="space-y-8"><h1 className="text-2xl font-semibold text-ink">열 확인하기</h1><UploadReview uploadId={data.upload.id} filename={data.upload.filename} cards={data.cards} /></main>;
}
