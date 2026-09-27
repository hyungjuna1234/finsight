import { HEADER_VOCAB, normalizeHeader } from "./table";

const KNOWN_HEADERS = new Set(Object.values(HEADER_VOCAB).flat().map(normalizeHeader));
const VALUE_WORD = /^(?:Y|N|정상|취소|부분취소|매입|미매입|일시불|\d+개월|[A-Z]{3})$/;
const SAFE_VALUE = /^(?:#|[\d\s,:().+\-₩원]+|(?:KRW\s*)?[\d,().+\-]+)$/i;
const DATE_TIME = /(?:\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|(?<!\d)\d{8}(?!\d))(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/g;

export function maskDigits(text: string): string {
  const preserved: string[] = [];
  const protectedText = text.replace(DATE_TIME, (value) => {
    preserved.push(value);
    return `\u0000${preserved.length - 1}\u0000`;
  });
  const masked = protectedText.replace(/\d(?:[\d\-* .]*\d)?/g, (token) =>
    (token.match(/\d/g)?.length ?? 0) >= 7 ? "#" : token,
  );
  return masked.replace(/\u0000(\d+)\u0000/g, (_, index: string) => preserved[Number(index)] ?? "");
}

function maskText(original: string, masked: string): string {
  const first = Array.from(masked)[0] ?? "";
  return `${first}***(${Array.from(original).length}자)`;
}

function maskCell(value: string): string {
  if (value === "") return value;
  const masked = maskDigits(value);
  if (SAFE_VALUE.test(masked) || VALUE_WORD.test(masked)) return masked;
  return maskText(value, masked);
}

export function maskSamples(headers: string[], rows: string[][]): { headers: string[]; samples: string[][] } {
  return {
    headers: headers.map((header) => KNOWN_HEADERS.has(normalizeHeader(header)) ? header : maskCell(header)),
    samples: rows.map((row) => row.map(maskCell)),
  };
}
