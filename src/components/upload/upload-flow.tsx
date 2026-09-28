"use client";

import { useRef, useState } from "react";
import { ApiError, apiFetch } from "@/components/ui/api-fetch";
import { OnboardingSteps } from "@/components/ui/onboarding-steps";
import { CopyLinkButton } from "@/components/marketing/copy-link-button";
import type { IssuerGuide } from "@/lib/domain/guides";
import type { AnalyzeResponse, CardChoice, ConfirmResponse, RecategorizeResponse } from "@/lib/domain/upload";
import type { ColumnMapping } from "@/lib/ingest/mapping";
import { CardField } from "./card-field";
import { FilePicker } from "./file-picker";
import { MappingReview } from "./mapping-review";
import { confirmFile, putFile, sha256Hex, startFile, type FileStage, type PipelineDeps } from "./upload-pipeline";
import { UploadError } from "./upload-error";
import { UploadResult } from "./upload-result";
import { IssuerPicker } from "./issuer-picker";

interface Item { key: number; file: File; stage: FileStage; uploadId?: string; analysis?: AnalyzeResponse; result?: ConfirmResponse; error?: ApiError; recategorizing?: boolean }
const STAGE: Record<FileStage, string> = { waiting: "대기 중", hashing: "파일 확인 중", uploading: "업로드 중", analyzing: "열 분석 중", review: "열 확인 필요", confirming: "거래 분석 중", done: "완료", error: "처리 실패" };
const deps: PipelineDeps = { api: apiFetch, put: putFile, sha256Hex };
function asApiError(error: unknown): ApiError { return error instanceof ApiError ? error : new ApiError("INTERNAL", 500, ""); }

export function UploadFlow({ cards, hasUploads, guides }: { cards: { id: string; name: string }[]; hasUploads: boolean; guides: readonly IssuerGuide[] }) {
  const [card, setCard] = useState<CardChoice | null>(cards[0] ? { id: cards[0].id } : { name: "" });
  const [items, setItems] = useState<Item[]>([]); const [running, setRunning] = useState(false); const nextKey = useRef(0);
  const update = (key: number, value: Partial<Item>) => setItems((all) => all.map((item) => item.key === key ? { ...item, ...value } : item));
  const validCard = card && ("id" in card || card.name.trim().length > 0);

  async function finish(key: number, uploadId: string, mapping: ColumnMapping) {
    update(key, { stage: "confirming" });
    try { const result = await confirmFile(uploadId, mapping, card!, deps); update(key, { stage: "done", result }); }
    catch (error) { update(key, { stage: "error", error: asApiError(error) }); }
  }
  async function run(files: File[]) {
    if (!validCard || running) return;
    setRunning(true);
    const queued = files.map((file) => ({ key: nextKey.current++, file, stage: "waiting" as const })); setItems((all) => [...all, ...queued]);
    for (const item of queued) {
      try {
        const started = await startFile(item.file, deps, (stage) => update(item.key, { stage }));
        update(item.key, { uploadId: started.uploadId, analysis: started.analysis });
        if (started.analysis.autoConfirm && started.analysis.mapping) await finish(item.key, started.uploadId, started.analysis.mapping);
        else {
          update(item.key, { stage: "review" });
          await new Promise<void>((resolve) => { reviewResolvers.current.set(item.key, resolve); });
        }
      } catch (error) { update(item.key, { stage: "error", error: asApiError(error) }); }
    }
    setRunning(false);
  }
  const reviewResolvers = useRef(new Map<number, () => void>());
  async function reviewSubmit(item: Item, mapping: ColumnMapping, selectedCard: CardChoice) {
    setCard(selectedCard); update(item.key, { stage: "confirming" });
    try { const result = await confirmFile(item.uploadId!, mapping, selectedCard, deps); update(item.key, { stage: "done", result }); }
    catch (error) { update(item.key, { stage: "error", error: asApiError(error) }); }
    reviewResolvers.current.get(item.key)?.(); reviewResolvers.current.delete(item.key);
  }
  async function recategorize(item: Item) {
    update(item.key, { recategorizing: true });
    try { const response = await apiFetch<RecategorizeResponse>(`/api/uploads/${item.uploadId}/recategorize`, { method: "POST" }); update(item.key, { recategorizing: false, result: item.result ? { ...item.result, pending: response.pending } : item.result }); }
    catch (error) { update(item.key, { recategorizing: false, error: asApiError(error) }); }
  }
  return <div className="space-y-6">
    {!hasUploads ? <>
      <OnboardingSteps current={2} />
      <section className="space-y-4 border-b border-line pb-6">
        <div className="space-y-1"><h2 className="text-base font-semibold text-ink">② 파일 받기</h2><p className="text-sm leading-relaxed text-body">카드사 홈페이지에서 &apos;이용내역&apos;을 최근 3개월로 받아요.</p></div>
        <div className="space-y-3 md:hidden"><p className="text-sm leading-relaxed text-body">휴대폰에서는 엑셀 저장이 어려워요. PC에서 이어서 해 주세요.</p><CopyLinkButton path="/upload" label="PC에서 열 링크 복사" /><p className="text-sm leading-relaxed text-muted">카카오톡 &apos;나와의 채팅&apos;에 붙여 두면 PC에서 바로 열 수 있어요.</p></div>
        <IssuerPicker guides={guides} />
      </section>
    </> : <a href="/guide" className="inline-block text-sm text-muted underline-offset-4 hover:text-ink hover:underline">파일은 어디서 받나요?</a>}
    <section className="space-y-6">
      {!hasUploads ? <h2 className="text-base font-semibold text-ink">③ 올리기</h2> : null}
      <CardField cards={cards} value={card} onChange={setCard} disabled={running} />
      {!validCard ? <p className="text-sm text-warning">카드 이름을 입력해 주세요.</p> : null}
      <FilePicker onFiles={run} disabled={running || !validCard} />
    </section>
    <div className="space-y-4">{items.map((item) => <section key={item.key} className="border-t border-line pt-4"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="truncate text-sm font-medium text-ink">{item.file.name}</h2><span className="shrink-0 text-sm text-muted">{STAGE[item.stage]}</span></div>
      {item.stage === "review" && item.analysis ? <MappingReview preview={item.analysis.preview} mapping={item.analysis.mapping} cards={cards} defaultCard={card ?? undefined} submitting={false} onSubmit={(mapping, selectedCard) => reviewSubmit(item, mapping, selectedCard)} /> : null}
      {item.result ? <UploadResult result={item.result} recategorizing={item.recategorizing} onRecategorize={() => recategorize(item)} /> : null}
      {item.error ? <UploadError error={item.error} /> : null}
    </section>)}</div>
  </div>;
}
