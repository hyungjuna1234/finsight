export const UPLOAD_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxRows: 10_000,
  maxSheets: 20,
  maxColumns: 100,
  maxCellChars: 500,
} as const;

export const ACCEPTED_EXTENSIONS = ["csv", "xls", "xlsx"] as const;
export type AcceptedExtension = (typeof ACCEPTED_EXTENSIONS)[number];

export const ACCEPT_ATTR =
  ".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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
