"use client";

import { ERROR_MESSAGES, type ErrorCode } from "@/lib/domain/errors";
import { guideHrefForError } from "@/lib/domain/guides";
import { redirectPathForError, type ApiError } from "@/components/ui/api-fetch";

const GUIDE_CODES = new Set<ErrorCode>(["FILE_TOO_LARGE", "UNSUPPORTED_FORMAT", "ENCRYPTED_FILE", "EMPTY_FILE", "ENCODING_ERROR", "CORRUPT_FILE", "TOO_MANY_ROWS", "FILE_TOO_COMPLEX", "HEADER_NOT_FOUND", "BILLING_STATEMENT", "BANK_STATEMENT", "MAPPING_INVALID", "NO_DATA"]);
export function UploadError({ error, onRetry }: { error: ApiError; onRetry?(): void }) {
  const redirect = redirectPathForError(error.code, "/upload");
  const message = error.code === "NETWORK" ? "네트워크 연결을 확인해 주세요." : ERROR_MESSAGES[error.code];
  return <div className="space-y-2"><p role="alert" className="text-sm text-warning">{message}</p>
    {GUIDE_CODES.has(error.code as ErrorCode) ? <a href={guideHrefForError(error.code) ?? "/guide"} className="text-sm text-accent underline-offset-4 hover:underline">가이드</a> : null}
    {error.code === "DUPLICATE_FILE" ? <a href="/dashboard" className="text-sm text-accent underline-offset-4 hover:underline">보기</a> : null}
    {error.code === "RATE_LIMITED" ? <p className="text-sm text-body">내일 다시 시도해 주세요.</p> : null}
    {redirect ? <a href={redirect} className="text-sm text-accent underline-offset-4 hover:underline">{error.code === "UNAUTHENTICATED" ? "로그인하기" : "이동하기"}</a> : null}
    {(["AI_UNAVAILABLE", "NETWORK", "INTERNAL"] as const).includes(error.code as never) && onRetry ? <button type="button" onClick={onRetry} className="rounded-md border border-line bg-surface px-4 py-2.5 text-sm text-ink hover:bg-bg">다시 시도</button> : null}
  </div>;
}
