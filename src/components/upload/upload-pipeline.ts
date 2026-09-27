import { ApiError, apiFetch } from "@/components/ui/api-fetch";
import type { AnalyzeResponse, CardChoice, ConfirmResponse, CreateUploadResponse } from "@/lib/domain/upload";
import type { ColumnMapping } from "@/lib/ingest/mapping";

export type FileStage = "waiting" | "hashing" | "uploading" | "analyzing" | "review" | "confirming" | "done" | "error";
export interface PipelineDeps { api: typeof apiFetch; put: (url: string, file: File) => Promise<boolean>; sha256Hex: (file: File) => Promise<string> }

export async function startFile(file: File, deps: PipelineDeps, onStage: (stage: FileStage) => void): Promise<{ uploadId: string; analysis: AnalyzeResponse }> {
  onStage("hashing");
  const sha256 = await deps.sha256Hex(file);
  onStage("uploading");
  const created = await deps.api<CreateUploadResponse>("/api/uploads", { method: "POST", body: { filename: file.name, size: file.size, sha256 } });
  if (!await deps.put(created.uploadUrl, file)) throw new ApiError("NETWORK", 0, "네트워크 연결을 확인해 주세요.");
  onStage("analyzing");
  const analysis = await deps.api<AnalyzeResponse>(`/api/uploads/${created.uploadId}/analyze`, { method: "POST" });
  return { uploadId: created.uploadId, analysis };
}

export function confirmFile(uploadId: string, mapping: ColumnMapping, card: CardChoice, deps: PipelineDeps): Promise<ConfirmResponse> {
  return deps.api<ConfirmResponse>(`/api/uploads/${uploadId}/confirm`, { method: "POST", body: { mapping, card } });
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
