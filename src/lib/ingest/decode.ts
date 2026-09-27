import { UPLOAD_LIMITS } from "@/lib/domain/upload";
import { err, ok, type Result } from "@/lib/domain/result";
import iconv from "iconv-lite";
import * as XLSX from "xlsx";
import * as cpexcel from "xlsx/dist/cpexcel.full.mjs";

import type { Sniff, TextEncoding } from "./sniff";

XLSX.set_cptable(cpexcel);

export interface Sheet {
  name: string;
  rows: string[][];
}

type DecodeError =
  | "ENCODING_ERROR"
  | "CORRUPT_FILE"
  | "TOO_MANY_ROWS"
  | "FILE_TOO_COMPLEX"
  | "ENCRYPTED_FILE";

export function normalizeCell(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replaceAll("\u00a0", " ")
    .trim()
    .slice(0, UPLOAD_LIMITS.maxCellChars);
}

function bomEncoding(bytes: Uint8Array): { encoding: TextEncoding; length: number } | null {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { encoding: "utf-8", length: 3 };
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { encoding: "utf-16le", length: 2 };
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { encoding: "utf-16be", length: 2 };
  return null;
}

function declaredEncoding(charset: string | null | undefined): "utf-8" | "cp949" | null {
  const normalized = charset?.trim().toLowerCase().replace(/["']/g, "") ?? "";
  if (["euc-kr", "ks_c_5601-1987", "cp949", "x-windows-949"].includes(normalized)) return "cp949";
  if (["utf-8", "utf8"].includes(normalized)) return "utf-8";
  return null;
}

function validCp949(text: string): boolean {
  const replacements = [...text].filter((character) => character === "\uFFFD").length;
  return replacements < 10 && (text.length === 0 || replacements / text.length <= 0.01);
}

export function decodeText(
  bytes: Uint8Array,
  encoding: TextEncoding | null,
  declaredCharset?: string | null,
): Result<string, "ENCODING_ERROR"> {
  const bom = bomEncoding(bytes);
  const source = bytes.subarray(bom?.length ?? 0);
  const selected = bom?.encoding ?? encoding ?? declaredEncoding(declaredCharset);
  try {
    if (selected === "cp949") {
      const text = iconv.decode(Buffer.from(source), "cp949");
      return validCp949(text) ? ok(text) : err("ENCODING_ERROR");
    }
    if (selected) return ok(new TextDecoder(selected, { fatal: true }).decode(source));
    try {
      return ok(new TextDecoder("utf-8", { fatal: true }).decode(source));
    } catch {
      const text = iconv.decode(Buffer.from(source), "cp949");
      return validCp949(text) ? ok(text) : err("ENCODING_ERROR");
    }
  } catch {
    return err("ENCODING_ERROR");
  }
}

function delimiterCounts(line: string): Record<"," | "\t" | ";", number> {
  const counts = { ",": 0, "\t": 0, ";": 0 };
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && (character === "," || character === "\t" || character === ";")) {
      counts[character] += 1;
    }
  }
  return counts;
}

export function sniffDelimiter(text: string): "," | "\t" | ";" {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim()).slice(0, 20);
  let best: { delimiter: "," | "\t" | ";"; consistency: number; count: number } | null = null;
  for (const delimiter of [",", "\t", ";"] as const) {
    const counts = lines.map((line) => delimiterCounts(line)[delimiter]).filter((count) => count >= 1);
    if (counts.length === 0) continue;
    const frequencies = new Map<number, number>();
    for (const count of counts) frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
    const [count, frequency] = [...frequencies].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]!;
    const candidate = { delimiter, consistency: frequency / lines.length, count };
    if (!best || candidate.consistency > best.consistency || (candidate.consistency === best.consistency && candidate.count > best.count)) best = candidate;
  }
  return best?.delimiter ?? ",";
}

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += character;
      continue;
    }
    if (character === '"' && field.length === 0) quoted = true;
    else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (character === "\r" && text[index + 1] === "\n") index += 1;
    } else field += character;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function findDeclaredCharset(bytes: Uint8Array): string | null {
  const ascii = Array.from(bytes.subarray(0, 8192), (byte) => String.fromCharCode(byte)).join("");
  return ascii.match(/<meta\b[^>]*charset\s*=\s*["']?\s*([^\s"'/>;]+)/i)?.[1]
    ?? ascii.match(/<meta\b[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([^\s"';>]+)/i)?.[1]
    ?? ascii.match(/<\?xml\b[^>]*encoding\s*=\s*["']([^"']+)/i)?.[1]
    ?? null;
}

function trimTrailingEmptyRows(rows: string[][]): string[][] {
  while (rows.length > 0 && rows.at(-1)!.every((cell) => cell === "")) rows.pop();
  return rows;
}

function workbookToSheets(workbook: XLSX.WorkBook): Result<Sheet[], "CORRUPT_FILE" | "TOO_MANY_ROWS" | "FILE_TOO_COMPLEX"> {
  if (workbook.SheetNames.length === 0) return err("CORRUPT_FILE");
  if (workbook.SheetNames.length > UPLOAD_LIMITS.maxSheets) return err("FILE_TOO_COMPLEX");
  const sheets: Sheet[] = [];
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) return err("CORRUPT_FILE");
    if (worksheet["!fullref"] && worksheet["!ref"] !== worksheet["!fullref"]) return err("TOO_MANY_ROWS");
    const range = worksheet["!ref"] ? XLSX.utils.decode_range(worksheet["!ref"]) : null;
    if (range && range.e.c + 1 > UPLOAD_LIMITS.maxColumns) return err("FILE_TOO_COMPLEX");
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
    });
    const width = rawRows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    if (width > UPLOAD_LIMITS.maxColumns) return err("FILE_TOO_COMPLEX");
    const rows = trimTrailingEmptyRows(rawRows.map((row) => Array.from({ length: width }, (_, index) => normalizeCell(row[index]))));
    if (rows.length > UPLOAD_LIMITS.maxRows) return err("TOO_MANY_ROWS");
    sheets.push({ name, rows });
  }
  return ok(sheets);
}

export function decodeFile(bytes: Uint8Array, sniff: Sniff): Result<Sheet[], DecodeError> {
  if (sniff.kind === "text") {
    const decoded = decodeText(bytes, sniff.encoding);
    if (!decoded.ok) return decoded;
    const parsed = parseDelimited(decoded.value, sniffDelimiter(decoded.value));
    const width = parsed.reduce((maximum, row) => Math.max(maximum, row.length), 0);
    if (width > UPLOAD_LIMITS.maxColumns) return err("FILE_TOO_COMPLEX");
    const rows = trimTrailingEmptyRows(parsed.map((row) => Array.from({ length: width }, (_, index) => normalizeCell(row[index]))));
    if (rows.length > UPLOAD_LIMITS.maxRows) return err("TOO_MANY_ROWS");
    return ok([{ name: "Sheet1", rows }]);
  }

  try {
    const workbook = sniff.kind === "html" || sniff.kind === "xml"
      ? (() => {
          const decoded = decodeText(bytes, sniff.encoding, findDeclaredCharset(bytes));
          if (!decoded.ok) return decoded;
          return XLSX.read(decoded.value, { type: "string", raw: true, dense: true, sheetRows: 10001 });
        })()
      : XLSX.read(bytes, { type: "array", dense: true, sheetRows: 10001 });
    if ("ok" in workbook && workbook.ok === false) return workbook;
    return workbookToSheets(workbook as XLSX.WorkBook);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return err(/password-protected/i.test(message) ? "ENCRYPTED_FILE" : "CORRUPT_FILE");
  }
}
