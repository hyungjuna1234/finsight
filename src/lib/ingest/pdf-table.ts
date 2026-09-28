import { err, ok, type Result } from "@/lib/domain/result";
import { UPLOAD_LIMITS } from "@/lib/domain/upload";

import { normalizeCell } from "./decode";
import { validateMapping, type ColumnMapping } from "./mapping";
import { parseDateCell } from "./parse";
import { periodHintFromText, type TableGuess } from "./table";

// PDF 명세서의 글자 조각을 표(TableGuess)로 묶는다. 카드사 PDF는 열 제목이 그림인 경우가 많아(NH) 제목에 기대지 않는다.
// - 날짜로 시작하고, 가맹점 글자와 숫자가 있는 줄만 거래로 본다(주소·이름·안내문은 표에 들어오지 않는다).
// - 숫자는 오른쪽 정렬이라 오른쪽 끝 x 좌표로 열을 나눈다.
// - 거래를 모은 뒤 "합계" 줄을 만나면 멈춘다. 그 아래의 해외이용 상세표 등이 같은 거래를 다시 적기 때문이다.

export interface PdfText { text: string; x: number; y: number; width: number; height: number }

const DATE_HEAD = /^(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}[.\-/]\d{1,2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일)(?:\s+(.*))?$/;
const TIME = /^\d{1,2}:\d{2}(?::\d{2})?(?:\s+|$)/;
const NUMBER = /^(?:[-(]?\d[\d,]*(?:\.\d+)?\)?-?원?(?:\([^)]*\))?|\d{1,2}\/\d{1,2})$/;
const GRAND_TOTAL = /^(?:합계|총계|총합계)/;
const COLUMN_TOLERANCE = 3;

interface Candidate { date: string; merchant: string; numbers: { text: string; right: number }[] }

function pageLines(items: PdfText[]): PdfText[][] {
  const lines: { y: number; items: PdfText[] }[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2, item.height * 0.4));
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines.map((line) => line.items.sort((a, b) => a.x - b.x));
}

function joinText(pieces: PdfText[]): string {
  let text = "";
  let previous: PdfText | null = null;
  for (const piece of pieces) {
    const gap = previous ? piece.x - (previous.x + previous.width) : 0;
    text += previous && gap > piece.height * 0.25 ? ` ${piece.text.trim()}` : piece.text.trim();
    previous = piece;
  }
  return text.trim();
}

function candidate(line: PdfText[]): Candidate | null {
  const [first, ...rest] = line;
  const match = first ? DATE_HEAD.exec(first.text.trim()) : null;
  if (!first || !match || !parseDateCell(match[1]!)) return null;
  const merchant: PdfText[] = [];
  const remainder = (match[2] ?? "").trim().replace(TIME, "");
  if (remainder) merchant.push({ ...first, text: remainder });
  let index = 0;
  for (; index < rest.length && !NUMBER.test(rest[index]!.text.trim()); index += 1) {
    if (merchant.length === 0 && TIME.test(rest[index]!.text.trim())) continue;
    merchant.push(rest[index]!);
  }
  const numbers = rest.slice(index).map((piece) => ({ text: piece.text.trim(), right: piece.x + piece.width }));
  const name = joinText(merchant);
  return name && numbers.length > 0 ? { date: match[1]!, merchant: name, numbers } : null;
}

export function pdfTable(pages: PdfText[][]): Result<TableGuess, "PDF_NO_TRANSACTIONS" | "TOO_MANY_ROWS" | "FILE_TOO_COMPLEX"> {
  const lines = pages.flatMap(pageLines);
  const candidates: Candidate[] = [];
  for (const line of lines) {
    if (candidates.length > 0 && GRAND_TOTAL.test(line.map((piece) => piece.text).join("").replace(/\s/g, ""))) break;
    const found = candidate(line);
    if (found) candidates.push(found);
  }
  if (candidates.length === 0) return err("PDF_NO_TRANSACTIONS");
  if (candidates.length > UPLOAD_LIMITS.maxRows) return err("TOO_MANY_ROWS");

  const columns: { min: number; max: number }[] = [];
  for (const edge of candidates.flatMap((found) => found.numbers.map((number) => number.right)).sort((a, b) => a - b)) {
    const last = columns.at(-1);
    if (last && edge - last.max <= COLUMN_TOLERANCE) last.max = edge;
    else columns.push({ min: edge, max: edge });
  }
  if (columns.length + 2 > UPLOAD_LIMITS.maxColumns) return err("FILE_TOO_COMPLEX");

  const headers = ["이용일", "이용하신 곳", ...columns.map((_, index) => `열 ${index + 3}`)];
  const dataRows = candidates.map((found) => {
    const cells = columns.map(() => "");
    for (const number of found.numbers) {
      const column = columns.findIndex((range) => number.right >= range.min && number.right <= range.max);
      cells[column] = cells[column] ? `${cells[column]} ${number.text}` : number.text;
    }
    return [found.date, found.merchant, ...cells].map(normalizeCell);
  });
  const text = lines.map((line) => line.map((piece) => piece.text).join(" ")).join("\n");
  return ok({ sheetName: "PDF", sheetRows: [headers, ...dataRows], headerRowIndex: 0, headers, dataRows, periodHint: periodHintFromText(text) });
}

// 표를 우리가 만들었으므로 날짜(0)·가맹점(1)은 정해져 있다. 금액은 금액으로 읽히는 첫 숫자 열(카드사 명세서의 "이용금액")이다.
export function suggestPdfMapping(table: TableGuess): ColumnMapping | null {
  for (let amount = 2; amount < table.headers.length; amount += 1) {
    const mapping: ColumnMapping = { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount } };
    if (validateMapping(mapping, table).ok) return mapping;
  }
  return null;
}
