import { ApiError, apiFetch } from "@/components/ui/api-fetch";
import type { AnalyzeResponse, CardChoice, ConfirmResponse, CreateUploadResponse } from "@/lib/domain/upload";
import type { ColumnMapping } from "@/lib/ingest/mapping";

export type FileStage = "waiting" | "hashing" | "uploading" | "analyzing" | "password" | "review" | "confirming" | "done" | "error";
export interface PipelineDeps { api: typeof apiFetch; put: (url: string, file: File) => Promise<boolean>; sha256Hex: (file: File) => Promise<string> }
export type AskPassword = (wrong: boolean) => Promise<string>;

export function isPasswordError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.code === "PDF_PASSWORD_REQUIRED" || error.code === "PDF_PASSWORD_WRONG");
}

// 비밀번호는 이 파일을 처리하는 동안 메모리에만 두고, 분석·확정 요청 body로만 보낸다.
export function analyzeFile(uploadId: string, password: string | undefined, deps: PipelineDeps): Promise<AnalyzeResponse> {
  return deps.api<AnalyzeResponse>(`/api/uploads/${uploadId}/analyze`, { method: "POST", body: password === undefined ? {} : { password } });
}

export async function startFile(file: File, deps: PipelineDeps, onStage: (stage: FileStage) => void, askPassword?: AskPassword): Promise<{ uploadId: string; analysis: AnalyzeResponse; password?: string }> {
  onStage("hashing");
  const sha256 = await deps.sha256Hex(file);
  onStage("uploading");
  const created = await deps.api<CreateUploadResponse>("/api/uploads", { method: "POST", body: { filename: file.name, size: file.size, sha256 } });
  if (!await deps.put(created.uploadUrl, file)) throw new ApiError("NETWORK", 0, "네트워크 연결을 확인해 주세요.");
  onStage("analyzing");
  let password: string | undefined;
  for (;;) {
    try {
      const analysis = await analyzeFile(created.uploadId, password, deps);
      return password === undefined ? { uploadId: created.uploadId, analysis } : { uploadId: created.uploadId, analysis, password };
    } catch (error) {
      if (!askPassword || !isPasswordError(error)) throw error;
      onStage("password");
      password = await askPassword(error.code === "PDF_PASSWORD_WRONG");
      onStage("analyzing");
    }
  }
}

export function confirmFile(uploadId: string, mapping: ColumnMapping, card: CardChoice, deps: PipelineDeps, password?: string): Promise<ConfirmResponse> {
  return deps.api<ConfirmResponse>(`/api/uploads/${uploadId}/confirm`, { method: "POST", body: password === undefined ? { mapping, card } : { mapping, card, password } });
}

export async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function putFile(url: string, file: File): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "PUT", body: file, headers: { "content-type": file.type || "application/octet-stream", "x-upsert": "false" } });
    return response.ok;
  } catch { return false; }
}
