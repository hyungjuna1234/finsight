import { UploadFlow } from "@/components/upload/upload-flow";
import { getUploadPageData } from "@/server/queries/uploads";

export default async function UploadPage() {
  const data = await getUploadPageData();
  return <main className="space-y-8"><div className="space-y-2"><h1 className="text-2xl font-semibold text-ink">내역 올리기</h1><p className="text-sm leading-relaxed text-body">원본은 90일 뒤 자동 삭제돼요. AI에는 가려진 샘플과 가맹점명만 보내요.</p></div><UploadFlow cards={data.cards} hasUploads={data.hasUploads} /></main>;
}
