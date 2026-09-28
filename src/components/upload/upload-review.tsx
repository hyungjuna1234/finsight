"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/components/ui/api-fetch";
import type { AnalyzeResponse, CardChoice, ConfirmResponse } from "@/lib/domain/upload";
import type { ColumnMapping } from "@/lib/ingest/mapping";
import { MappingReview } from "./mapping-review";
import { PasswordPrompt } from "./password-prompt";
import { analyzeFile, confirmFile, isPasswordError, putFile, sha256Hex, type PipelineDeps } from "./upload-pipeline";
import { UploadError } from "./upload-error";
import { UploadResult } from "./upload-result";

const deps: PipelineDeps = { api: apiFetch, put: putFile, sha256Hex };
function asApiError(error: unknown): ApiError { return error instanceof ApiError ? error : new ApiError("INTERNAL", 500, ""); }
function passwordAsk(error: unknown): "required" | "wrong" | null { return isPasswordError(error) ? (error.code === "PDF_PASSWORD_WRONG" ? "wrong" : "required") : null; }

export function UploadReview({ uploadId, filename, cards }: { uploadId: string; filename: string; cards: { id: string; name: string }[] }) {
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null); const [result, setResult] = useState<ConfirmResponse | null>(null); const [error, setError] = useState<ApiError | null>(null); const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState<string>(); const [asking, setAsking] = useState<"required" | "wrong" | null>(null);
  async function analyze(nextPassword = password) { setError(null); setAsking(null); try { setAnalysis(await analyzeFile(uploadId, nextPassword, deps)); setPassword(nextPassword); } catch (e) { const ask = passwordAsk(e); if (ask) setAsking(ask); else setError(asApiError(e)); } }
  useEffect(() => {
    let active = true;
    void analyzeFile(uploadId, undefined, deps).then(
      (value) => { if (active) setAnalysis(value); },
      (reason: unknown) => { if (!active) return; const ask = passwordAsk(reason); if (ask) setAsking(ask); else setError(asApiError(reason)); },
    );
    return () => { active = false; };
  }, [uploadId]);
  async function submit(mapping: ColumnMapping, card: CardChoice) { setSubmitting(true); try { setResult(await confirmFile(uploadId, mapping, card, deps, password)); } catch (e) { setError(asApiError(e)); } finally { setSubmitting(false); } }
  return <div className="space-y-5"><h2 className="text-base font-semibold text-ink">{filename}</h2>{!analysis && !error && !asking ? <p className="text-sm text-muted">파일을 분석하고 있어요.</p> : null}{asking ? <PasswordPrompt wrong={asking === "wrong"} onSubmit={(value) => void analyze(value)} /> : null}{analysis && !result ? <MappingReview preview={analysis.preview} mapping={analysis.mapping} cards={cards} submitting={submitting} onSubmit={submit} /> : null}{result ? <UploadResult result={result} /> : null}{error ? <UploadError error={error} onRetry={analyze} /> : null}</div>;
}
