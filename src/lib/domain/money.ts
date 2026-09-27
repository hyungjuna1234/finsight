import type { KRW } from "./types";

const integerFormatter = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });

export function toKRW(value: number): KRW {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("KRW must be a non-negative safe integer");
  }
  return value as KRW;
}

export function formatKRW(amount: KRW): string {
  return `₩${integerFormatter.format(amount)}`;
}

export function formatKRWShort(amount: KRW): string {
  if (amount === 0) return "0";
  return `${integerFormatter.format(Math.round(amount / 10_000))}만`;
}

export function sumKRW(values: KRW[]): KRW {
  return toKRW(values.reduce<number>((sum, value) => sum + value, 0));
}
