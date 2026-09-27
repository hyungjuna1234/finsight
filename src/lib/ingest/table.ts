import { isIsoDate } from "@/lib/domain/month";
import { err, ok, type Result } from "@/lib/domain/result";
import type { IsoDate } from "@/lib/domain/types";

import type { Sheet } from "./decode";

export interface TableGuess {
  sheetName: string;
  sheetRows: string[][];
  headerRowIndex: number;
  headers: string[];
  dataRows: string[][];
  periodHint: { from: IsoDate; to: IsoDate } | null;
}

export const HEADER_VOCAB = {
  date: ["이용일자", "이용일", "이용일시", "거래일자", "거래일", "거래일시", "승인일자", "승인일", "매출일자", "매출일", "사용일", "사용일자", "결제일자", "결제일", "일자", "날짜"],
  merchant: ["가맹점명", "가맹점", "이용가맹점", "이용하신곳", "이용처", "사용처", "상호", "상호명", "매장명", "업체명", "사용가맹점", "거래처", "가맹점상호"],
  amount: ["이용금액", "국내이용금액", "승인금액", "매출금액", "결제금액", "원화금액", "거래금액", "금액", "사용금액", "국내금액", "원화환산금액", "청구전금액"],
  other: ["승인번호", "할부", "할부개월", "할부기간", "해외이용금액", "현지금액", "통화", "통화코드", "취소여부", "상태", "매입상태", "카드번호", "이용카드", "결제방법", "카드명", "승인상태", "구분"],
  billing: ["회차", "청구금액", "결제원금", "청구원금", "잔여금액", "잔여원금", "납부금액"],
  bank: ["잔액", "거래후잔액", "입금", "출금", "입금액", "출금액", "맡기신금액", "찾으신금액", "적요", "거래점", "예금잔액"],
} as const;

export function normalizeHeader(header: string): string {
  return header.normalize("NFKC").replace(/\([^)]*\)/g, "").replace(/\s/g, "").toLowerCase();
}

const VOCAB = new Set(Object.values(HEADER_VOCAB).flat().map(normalizeHeader));
const DATE_VOCAB = new Set(HEADER_VOCAB.date.map(normalizeHeader));
const BILLING_VOCAB = new Set(["회차", "청구금액", "결제원금", "청구원금"].map(normalizeHeader));
const BANK_BALANCE = new Set(["잔액", "거래후잔액", "예금잔액"].map(normalizeHeader));
const BANK_FLOW = new Set(["입금", "출금", "입금액", "출금액", "맡기신금액", "찾으신금액"].map(normalizeHeader));

export function isSummaryRow(cells: string[]): boolean {
  return cells.some((cell) => /^(?:합계|소계|총계|총합계|total)/i.test(cell.replace(/\s/g, "")));
}

function rowsAt(sheetRows: string[][], headerRowIndex: number): { headers: string[]; dataRows: string[][] } | null {
  const sourceHeaders = sheetRows[headerRowIndex];
  if (!sourceHeaders) return null;
  const last = sourceHeaders.findLastIndex((cell) => cell !== "");
  if (last < 0) return null;
  const headers = sourceHeaders.slice(0, last + 1);
  const dataRows = sheetRows.slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => Array.from({ length: headers.length }, (_, index) => row[index] ?? ""));
  return { headers, dataRows };
}

export function tableAtHeader(table: TableGuess, headerRowIndex: number): TableGuess | null {
  if (!Number.isInteger(headerRowIndex) || headerRowIndex < 0 || headerRowIndex >= table.sheetRows.length) return null;
  const rows = rowsAt(table.sheetRows, headerRowIndex);
  return rows ? { ...table, headerRowIndex, ...rows } : null;
}

function iso(year: string, month: string, day: string): IsoDate | null {
  const value = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isIsoDate(value) ? value : null;
}

function periodHint(rows: string[][]): { from: IsoDate; to: IsoDate } | null {
  const text = rows.slice(0, 30).flat().join(" ");
  const numeric = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*(?:~|-)\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/.exec(text);
  const korean = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(?:~|-)\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(text);
  const match = numeric ?? korean;
  if (!match) return null;
  const from = iso(match[1]!, match[2]!, match[3]!);
  const to = iso(match[4]!, match[5]!, match[6]!);
  return from && to && from <= to ? { from, to } : null;
}

export function detectTable(sheets: Sheet[]): Result<TableGuess, "HEADER_NOT_FOUND" | "BILLING_STATEMENT" | "BANK_STATEMENT"> {
  const candidates: Array<TableGuess & { sheetIndex: number; score: number }> = [];
  sheets.forEach((sheet, sheetIndex) => {
    let best: { headerRowIndex: number; score: number } | null = null;
    for (const [headerRowIndex, row] of sheet.rows.slice(0, 30).entries()) {
      const normalized = row.map(normalizeHeader).filter(Boolean);
      const matches = normalized.filter((header) => VOCAB.has(header));
      if (row.filter((cell) => cell !== "").length < 3 || matches.length < 2 || !normalized.some((header) => DATE_VOCAB.has(header))) continue;
      if (!best || matches.length > best.score) best = { headerRowIndex, score: matches.length };
    }
    if (!best) return;
    const base: TableGuess = { sheetName: sheet.name, sheetRows: sheet.rows, headerRowIndex: best.headerRowIndex, headers: [], dataRows: [], periodHint: periodHint(sheet.rows) };
    const table = tableAtHeader(base, best.headerRowIndex);
    if (table) candidates.push({ ...table, sheetIndex, score: best.score });
  });
  candidates.sort((a, b) => b.dataRows.length - a.dataRows.length || a.sheetIndex - b.sheetIndex);
  const selected = candidates[0];
  if (!selected) return err("HEADER_NOT_FOUND");
  const normalized = selected.headers.map(normalizeHeader);
  if (normalized.some((header) => BILLING_VOCAB.has(header))) return err("BILLING_STATEMENT");
  if (normalized.some((header) => BANK_BALANCE.has(header)) && normalized.some((header) => BANK_FLOW.has(header))) return err("BANK_STATEMENT");
  return ok({
    sheetName: selected.sheetName,
    sheetRows: selected.sheetRows,
    headerRowIndex: selected.headerRowIndex,
    headers: selected.headers,
    dataRows: selected.dataRows,
    periodHint: selected.periodHint,
  });
}
