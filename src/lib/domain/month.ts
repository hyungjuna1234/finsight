import type { IsoDate, YearMonth } from "./types";

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1_000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

function parseYearMonth(value: YearMonth): { year: number; month: number } {
  const match = YEAR_MONTH_PATTERN.exec(value);
  if (!match) throw new RangeError("Invalid YearMonth");
  return { year: Number(match[1]), month: Number(match[2]) };
}

function makeYearMonth(year: number, month: number): YearMonth {
  return `${String(year).padStart(4, "0")}-${pad(month)}` as YearMonth;
}

export function kstToday(now: Date = new Date()): IsoDate {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}` as IsoDate;
}

export function toYearMonth(input: Date | IsoDate): YearMonth {
  if (input instanceof Date) {
    const kst = new Date(input.getTime() + KST_OFFSET_MS);
    return makeYearMonth(kst.getUTCFullYear(), kst.getUTCMonth() + 1);
  }
  return input.slice(0, 7) as YearMonth;
}

export function isYearMonth(value: string): value is YearMonth {
  const match = YEAR_MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function monthRange(value: YearMonth): { from: IsoDate; to: IsoDate } {
  const { year, month } = parseYearMonth(value);
  return {
    from: `${value}-01` as IsoDate,
    to: `${value}-${pad(daysInMonth(year, month))}` as IsoDate,
  };
}

function shiftMonth(value: YearMonth, offset: number): YearMonth {
  const { year, month } = parseYearMonth(value);
  const absoluteMonth = year * 12 + month - 1 + offset;
  return makeYearMonth(Math.floor(absoluteMonth / 12), (absoluteMonth % 12) + 1);
}

export function prevMonth(value: YearMonth): YearMonth {
  return shiftMonth(value, -1);
}

export function nextMonth(value: YearMonth): YearMonth {
  return shiftMonth(value, 1);
}

export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  if (from > to) return [];
  const months: YearMonth[] = [];
  for (let current = from; current <= to; current = nextMonth(current)) months.push(current);
  return months;
}
