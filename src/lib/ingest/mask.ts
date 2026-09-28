import { HEADER_VOCAB, normalizeHeader } from "./table";

const KNOWN_HEADERS = new Set(Object.values(HEADER_VOCAB).flat().map(normalizeHeader));
const VALUE_WORD = /^(?:Y|N|정상|취소|부분취소|매입|미매입|일시불|\d+개월|[A-Z]{3})$/;
const SAFE_VALUE = /^(?:#|[\d\s,:().+\-₩원]+|(?:KRW\s*)?[\d,().+\-]+)$/i;
const DATE_TIME = /(?<![\d.*-])(?:19|20)\d{2}(?:[.\-/]\d{1,2}[.\-/]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?|\d{4})(?!\d|[.*-]\d)/g;

function isValidDateTime(value: string): boolean {
  const separated = /^(?:19|20)\d{2}[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (separated) {
    const [, month, day, hour, minute, second] = separated;
    return Number(month) >= 1 && Number(month) <= 12
      && Number(day) >= 1 && Number(day) <= 31
      && (hour === undefined || (Number(hour) <= 23 && Number(minute) <= 59 && (second === undefined || Number(second) <= 59)));
  }
  const compact = /^(?:19|20)\d{2}(\d{2})(\d{2})$/.exec(value);
  return compact !== null
    && Number(compact[1]) >= 1 && Number(compact[1]) <= 12
    && Number(compact[2]) >= 1 && Number(compact[2]) <= 31;
}

export function maskDigits(text: string): string {
  const normalized = text.normalize("NFKC");
  const preserved: string[] = [];
  const protectedText = normalized.replace(DATE_TIME, (value) => {
    if (!isValidDateTime(value)) return value;
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
