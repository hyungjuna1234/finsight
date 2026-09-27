import { toKRW } from "@/lib/domain/money";
import { isIsoDate } from "@/lib/domain/month";
import type { IsoDate, KRW, TxKind, TxStatus } from "@/lib/domain/types";

import type { ColumnMapping } from "./mapping";
import { maskDigits } from "./mask";
import { normalizeMerchant } from "./merchant";
import { isSummaryRow, normalizeHeader, tableAtHeader, type TableGuess } from "./table";

export interface DateParts { year: number | null; month: number; day: number }

function valid(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days;
}

function parts(year: number | null, month: number, day: number): DateParts | null {
  return valid(year ?? 2000, month, day) ? { year, month, day } : null;
}

export function parseDateCell(raw: string): DateParts | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{5}(?:\.\d+)?$/.test(value)) {
    const serial = Math.floor(Number(value));
    if (serial < 20_000 || serial > 80_000) return null;
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }
  let match = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?(?:\s*\([^)]+\))?$/.exec(value);
  if (match) return parts(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{4})(\d{2})(\d{2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(value);
  if (match) return parts(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s*\([^)]+\))?$/.exec(value);
  if (match) return parts(2000 + Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s*\([^)]+\))?$/.exec(value);
  if (match) return parts(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[.\-/](\d{1,2})(?:\s*\([^)]+\))?$/.exec(value);
  if (match) return parts(null, Number(match[1]), Number(match[2]));
  match = /^(\d{1,2})월\s*(\d{1,2})일(?:\s*\([^)]+\))?$/.exec(value);
  return match ? parts(null, Number(match[1]), Number(match[2])) : null;
}

export function parseAmountCell(raw: string): number | null {
  let value = raw.trim();
  if (!value) return null;
  value = value.replace(/^(?:(?:예상|추정|미확정)\s*)+/, "").trim();
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1).trim();
  }
  value = value.replace(/^KRW\s*/i, "").replace(/^₩\s*/, "").replace(/\s*원$/, "").trim();
  if (value.startsWith("-")) { negative = true; value = value.slice(1); }
  if (value.endsWith("-")) { negative = true; value = value.slice(0, -1); }
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(value)) return null;
  const amount = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(Math.abs(amount));
  return negative ? -rounded : rounded;
}

export type SkipReason = "summary" | "blank" | "bad_date" | "bad_amount" | "zero_amount";

export interface ParsedRow {
  index: number;
  occurredOn: IsoDate;
  merchantRaw: string;
  merchantKey: string;
  amountKrw: KRW;
  kind: TxKind;
  status: TxStatus;
  approvalNo: string | null;
  installmentMonths: number | null;
  foreignAmount: number | null;
  foreignCurrency: string | null;
  cardLast4: string | null;
  occurrence: number;
}

export interface ParseResult {
  rows: ParsedRow[];
  skipped: { index: number; reason: SkipReason }[];
  period: { from: IsoDate; to: IsoDate } | null;
}

const DAY_MS = 86_400_000;

function dateValue(parts: DateParts, table: TableGuess, today: IsoDate): IsoDate | null {
  const make = (year: number) => `${year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  if (parts.year !== null) return isIsoDate(make(parts.year)) ? make(parts.year) as IsoDate : null;
  let years: number[];
  if (table.periodHint) {
    const fromYear = Number(table.periodHint.from.slice(0, 4));
    const toYear = Number(table.periodHint.to.slice(0, 4));
    years = Array.from({ length: toYear - fromYear + 1 }, (_, index) => fromYear + index);
    const lower = Date.parse(`${table.periodHint.from}T00:00:00Z`) - 31 * DAY_MS;
    const upper = Date.parse(`${table.periodHint.to}T00:00:00Z`) + 31 * DAY_MS;
    const match = years.map(make).find((candidate) => isIsoDate(candidate) && Date.parse(`${candidate}T00:00:00Z`) >= lower && Date.parse(`${candidate}T00:00:00Z`) <= upper);
    return match as IsoDate | undefined ?? null;
  }
  const year = Number(today.slice(0, 4));
  let candidate = make(year);
  if (!isIsoDate(candidate)) return null;
  if (Date.parse(`${candidate}T00:00:00Z`) > Date.parse(`${today}T00:00:00Z`) + 31 * DAY_MS) candidate = make(year - 1);
  return isIsoDate(candidate) ? candidate : null;
}

function numeric(raw: string): number | null {
  const match = raw.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function currency(cell: string, amountCell: string, header: string): string | null {
  if (cell.includes("$") || amountCell.includes("$")) return "USD";
  const direct = /\b([A-Z]{3})\b/i.exec(cell)?.[1];
  const embedded = /\b([A-Z]{3})\b/i.exec(amountCell)?.[1];
  const inHeader = /\(([A-Z]{3})\)/i.exec(header)?.[1];
  return (direct ?? embedded ?? inHeader)?.toUpperCase() ?? null;
}

function installment(raw: string): number | null {
  const value = raw.normalize("NFKC").trim();
  if (!value || value === "일시불") return null;
  const match = /^(\d{1,2})(?:개월)?$/.exec(value);
  if (!match) return null;
  const months = Number(match[1]);
  return months >= 2 && months <= 60 ? months : null;
}

export function parseRows(table: TableGuess, mapping: ColumnMapping, today: IsoDate): ParseResult {
  const selected = mapping.headerRowIndex === table.headerRowIndex ? table : tableAtHeader(table, mapping.headerRowIndex);
  if (!selected) return { rows: [], skipped: [], period: null };
  const rows: ParsedRow[] = [];
  const skipped: ParseResult["skipped"] = [];
  const occurrences = new Map<string, number>();
  const columns = mapping.columns;
  for (const [index, row] of selected.dataRows.entries()) {
    if (isSummaryRow(row)) { skipped.push({ index, reason: "summary" }); continue; }
    const dateCell = row[columns.date] ?? "";
    const merchantCell = row[columns.merchant] ?? "";
    const amountCell = row[columns.amount] ?? "";
    if (![dateCell, merchantCell, amountCell].some((value) => value.trim())) { skipped.push({ index, reason: "blank" }); continue; }
    const dateParts = parseDateCell(dateCell);
    const occurredOn = dateParts ? dateValue(dateParts, selected, today) : null;
    const maxDate = Date.parse(`${today}T00:00:00Z`) + 31 * DAY_MS;
    if (!occurredOn || occurredOn < "2000-01-01" || Date.parse(`${occurredOn}T00:00:00Z`) > maxDate) { skipped.push({ index, reason: "bad_date" }); continue; }
    const parsedAmount = parseAmountCell(amountCell);
    if (parsedAmount === null || !Number.isSafeInteger(parsedAmount)) { skipped.push({ index, reason: "bad_amount" }); continue; }
    if (parsedAmount === 0) { skipped.push({ index, reason: "zero_amount" }); continue; }
    const kind: TxKind = parsedAmount < 0 ? "refund" : "spend";
    const amountKrw = toKRW(Math.abs(parsedAmount));
    const stateCell = columns.cancelFlag === undefined ? "" : row[columns.cancelFlag] ?? "";
    const compactState = stateCell.normalize("NFKC").replace(/\s/g, "");
    const stateHeader = columns.cancelFlag === undefined ? "" : normalizeHeader(selected.headers[columns.cancelFlag] ?? "");
    const cancelled = !compactState.includes("부분취소") && (compactState.includes("취소") || (stateHeader.includes("취소") && /^(?:Y|예|O)$/i.test(compactState)));
    const foreignAmountCell = columns.foreignAmount === undefined ? "" : row[columns.foreignAmount] ?? "";
    const foreignAmount = numeric(foreignAmountCell);
    const currencyCell = columns.foreignCurrency === undefined ? "" : row[columns.foreignCurrency] ?? "";
    const currencyHeader = columns.foreignCurrency === undefined ? "" : selected.headers[columns.foreignCurrency] ?? "";
    const foreignCurrency = currency(currencyCell, foreignAmountCell, currencyHeader);
    const foreign = (foreignAmount !== null && foreignAmount !== 0) || (!!currencyCell.trim() && !/^(?:KRW|원)$/i.test(currencyCell.trim()));
    const pending = foreign && (/미매입|매입전|미확정|승인대기/.test(compactState) || /예상|추정|미확정/.test(amountCell));
    const status: TxStatus = cancelled ? "cancelled" : pending ? "pending" : "posted";
    const maskedMerchant = maskDigits(merchantCell).slice(0, 100);
    const merchantRaw = maskedMerchant || "알 수 없음";
    const merchantKey = normalizeMerchant(merchantRaw);
    const approvalRaw = columns.approvalNo === undefined ? "" : row[columns.approvalNo] ?? "";
    const approvalNo = approvalRaw.replace(/\s/g, "").replace(/[^\p{L}\p{N}]/gu, "") || null;
    const cardDigits = columns.cardNumber === undefined ? "" : (row[columns.cardNumber] ?? "").replace(/\D/g, "");
    const cardLast4 = cardDigits.length >= 4 ? cardDigits.slice(-4) : null;
    const occurrenceKey = approvalNo ? JSON.stringify([approvalNo, occurredOn, kind]) : JSON.stringify([occurredOn, merchantKey, amountKrw, kind]);
    const occurrence = occurrences.get(occurrenceKey) ?? 0;
    occurrences.set(occurrenceKey, occurrence + 1);
    rows.push({ index, occurredOn, merchantRaw, merchantKey, amountKrw, kind, status, approvalNo, installmentMonths: installment(columns.installment === undefined ? "" : row[columns.installment] ?? ""), foreignAmount: foreignAmount && foreignAmount !== 0 ? foreignAmount : null, foreignCurrency, cardLast4, occurrence });
  }
  const dates = rows.map((row) => row.occurredOn).sort();
  return { rows, skipped, period: dates.length ? { from: dates[0]!, to: dates.at(-1)! } : null };
}
