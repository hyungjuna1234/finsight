export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 10_000,
  maxSheets: 20,
  maxColumns: 100,
  maxCellChars: 500,
} as const;

export const ACCEPTED_EXTENSIONS = ["csv", "xls", "xlsx", "pdf"] as const;
export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];

export const ACCEPT_ATTR =
  ".csv,.xls,.xlsx,.pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf";

export function fileExtension(filename: string): AcceptedExtension | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return null;
  const extension = filename.slice(dot + 1).toLowerCase();
  return ACCEPTED_EXTENSIONS.find((accepted) => accepted === extension) ?? null;
}

export function checkUploadFile(f: {
  name: string;
  size: number;
}): "FILE_TOO_LARGE" | "UNSUPPORTED_FORMAT" | "EMPTY_FILE" | null {
  if (f.size === 0) return "EMPTY_FILE";
  if (f.size > UPLOAD_LIMITS.maxBytes) return "FILE_TOO_LARGE";
  if (!fileExtension(f.name)) return "UNSUPPORTED_FORMAT";
  return null;
}
import type { IsoDate } from "./types";

export type { ColumnMapping } from "@/lib/ingest/mapping";
import type { ColumnMapping } from "@/lib/ingest/mapping";

export type CardChoice = { id: string } | { name: string };
export interface UploadPreview { sheetName: string; headerRowIndex: number; rows: string[][] }
export interface CreateUploadResponse { uploadId: string; uploadUrl: string }
export interface AnalyzeResponse { preview: UploadPreview; mapping: ColumnMapping | null; autoConfirm: boolean }
export interface ConfirmResponse { inserted: number; duplicates: number; pending: number; period: { from: IsoDate; to: IsoDate } | null }
export interface RecategorizeResponse { updated: number; pending: number }
