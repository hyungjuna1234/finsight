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
