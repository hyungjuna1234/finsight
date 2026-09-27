"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/components/ui/api-fetch";
import type { AnalyzeResponse, CardChoice, ConfirmResponse } from "@/lib/domain/upload";
import type { ColumnMapping } from "@/lib/ingest/mapping";
import { MappingReview } from "./mapping-review";
import { confirmFile, putFile, sha256Hex } from "./upload-pipeline";
import { UploadError } from "./upload-error";
import { UploadResult } from "./upload-result";

export function UploadReview({ uploadId, filename, cards }: { uploadId: string; filename: string; cards: { id: string; name: string }[] }) {
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null); const [result, setResult] = useState<ConfirmResponse | null>(null); const [error, setError] = useState<ApiError | null>(null); const [submitting, setSubmitting] = useState(false);
  async function analyze() { setError(null); try { setAnalysis(await apiFetch<AnalyzeResponse>(`/api/uploads/${uploadId}/analyze`, { method: "POST" })); } catch (e) { setError(e instanceof ApiError ? e : new ApiError("INTERNAL", 500, "")); } }
  useEffect(() => {
    let active = true;
    void apiFetch<AnalyzeResponse>(`/api/uploads/${uploadId}/analyze`, { method: "POST" }).then(
      (value) => { if (active) setAnalysis(value); },
      (reason: unknown) => { if (active) setError(reason instanceof ApiError ? reason : new ApiError("INTERNAL", 500, "")); },
    );
    return () => { active = false; };
  }, [uploadId]);
  async function submit(mapping: ColumnMapping, card: CardChoice) { setSubmitting(true); try { setResult(await confirmFile(uploadId, mapping, card, { api: apiFetch, put: putFile, sha256Hex })); } catch (e) { setError(e instanceof ApiError ? e : new ApiError("INTERNAL", 500, "")); } finally { setSubmitting(false); } }
  return <div className="space-y-5"><h2 className="text-base font-semibold text-ink">{filename}</h2>{!analysis && !error ? <p className="text-sm text-muted">파일을 분석하고 있어요.</p> : null}{analysis && !result ? <MappingReview preview={analysis.preview} mapping={analysis.mapping} cards={cards} submitting={submitting} onSubmit={submit} /> : null}{result ? <UploadResult result={result} /> : null}{error ? <UploadError error={error} onRetry={analyze} /> : null}</div>;
}
