import type { IsoDate } from "@/lib/domain/types";
import iconv from "iconv-lite";
import * as XLSX from "xlsx";

export const FIXTURE_TODAY = "2026-09-30" as IsoDate;

export type FixtureStage = "sniff" | "decode" | "table";
export type ExpectedSkip = "summary" | "blank" | "bad_date" | "bad_amount" | "zero_amount";

export interface ExpectedMapping {
  date: number;
  merchant: number;
  amount: number;
  approvalNo?: number;
  installment?: number;
  cancelFlag?: number;
  foreignAmount?: number;
  foreignCurrency?: number;
  cardNumber?: number;
}

export interface FixtureExpect {
  sniff?: "xlsx" | "xls" | "html" | "xml" | "text";
  error?: { stage: FixtureStage; code: string };
  sheetCount?: number;
  sheetName?: string;
  headerRowIndex?: number;
  headers?: string[];
  mapping?: ExpectedMapping;
  periodHint?: { from: string; to: string } | null;
  parsed?: {
    rows: number;
    spend: number;
    refund: number;
    cancelled: number;
    pending: number;
    netSpendKrw: number;
    skipped: Partial<Record<ExpectedSkip, number>>;
    period: { from: string; to: string };
  };
}

export interface StatementFixture {
  name: string;
  issuer: string | null;
  filename: string;
  bytes: Uint8Array;
  expect: FixtureExpect;
}

type ParsedRowExpectation = {
  kind: "spend" | "refund";
  status: "posted" | "pending" | "cancelled";
  amountKrw: number;
  occurredOn: string;
};
type RowExpectation = ParsedRowExpectation | { skip: ExpectedSkip } | null;
type AnnotatedRow = { cells: unknown[]; expect: RowExpectation };

const encoder = new TextEncoder();
let regularCache: StatementFixture[] | undefined;
let heavyCache: StatementFixture[] | undefined;
let foreignPairCache: [StatementFixture, StatementFixture] | undefined;

function utf8(text: string): Uint8Array {
  return encoder.encode(text);
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function delimited(rows: unknown[][], delimiter = ","): string {
  return rows.map((row) => row.map(csvCell).join(delimiter)).join("\n");
}

function utf16leBom(text: string): Uint8Array {
  const body = Buffer.from(text, "utf16le");
  return new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), body]));
}

function workbookBytes(
  sheets: Array<{ name: string; rows: unknown[][] }>,
  bookType: "xlsx" | "xlml" | "biff8",
): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const output = XLSX.write(workbook, { type: "buffer", bookType });
  return new Uint8Array(output);
}

function summarize(rows: AnnotatedRow[]): NonNullable<FixtureExpect["parsed"]> {
  const parsed = rows.flatMap(({ expect }) =>
    expect && "kind" in expect ? [expect] : [],
  );
  const skipped: Partial<Record<ExpectedSkip, number>> = {};
  for (const row of rows) {
    if (!row.expect || !("skip" in row.expect)) continue;
    skipped[row.expect.skip] = (skipped[row.expect.skip] ?? 0) + 1;
  }
  const active = parsed.filter(({ status }) => status !== "cancelled");
  const dates = parsed.map(({ occurredOn }) => occurredOn).sort();
  return {
    rows: parsed.length,
    spend: active.filter(({ kind }) => kind === "spend").length,
    refund: active.filter(({ kind }) => kind === "refund").length,
    cancelled: parsed.filter(({ status }) => status === "cancelled").length,
    pending: parsed.filter(({ status }) => status === "pending").length,
    netSpendKrw: active.reduce(
      (sum, row) => sum + (row.kind === "spend" ? row.amountKrw : -row.amountKrw),
      0,
    ),
    skipped,
    period: { from: dates[0] ?? "", to: dates.at(-1) ?? "" },
  };
}

function fixture(
  data: Omit<StatementFixture, "expect"> & { expect: Omit<FixtureExpect, "parsed">; rows?: AnnotatedRow[] },
): StatementFixture {
  return {
    name: data.name,
    issuer: data.issuer,
    filename: data.filename,
    bytes: data.bytes,
    expect: { ...data.expect, ...(data.rows ? { parsed: summarize(data.rows) } : {}) },
  };
}

/** 7행 파싱 · 취소 1 · 환불 1 · 순지출 ₩187,400 · 건너뜀: 합계1·0원1·날짜2. */
function shinhanCsvBom(): StatementFixture {
  const headers = ["이용일자", "이용카드", "가맹점명", "이용금액", "할부개월", "승인번호", "취소여부"];
  const rows: AnnotatedRow[] = [
    { cells: ["2026.08.03", "본인 1234-****-****-5678", "초록식당", "50,000", "", "81000001", ""], expect: { kind: "spend", status: "posted", amountKrw: 50_000, occurredOn: "2026-08-03" } },
    { cells: ["2026.08.03", "본인 1234-****-****-5678", "초록식당", "50,000", "", "81000002", ""], expect: { kind: "spend", status: "posted", amountKrw: 50_000, occurredOn: "2026-08-03" } },
    { cells: ["2026.08.04", "본인 1234-****-****-5678", "가상서점", "40,000", "3", "81000003", ""], expect: { kind: "spend", status: "posted", amountKrw: 40_000, occurredOn: "2026-08-04" } },
    { cells: ["2026.08.05", "본인 1234-****-****-5678", "스마트스토어 010-1234-5678", "35,400", "", "81000004", ""], expect: { kind: "spend", status: "posted", amountKrw: 35_400, occurredOn: "2026-08-05" } },
    { cells: ["2026.08.06", "본인 1234-****-****-5678", "가상마트", "24,000", "", "81000005", ""], expect: { kind: "spend", status: "posted", amountKrw: 24_000, occurredOn: "2026-08-06" } },
    { cells: ["2026.08.08", "본인 1234-****-****-5678", "가상상점", "(12,000)", "", "81000006", ""], expect: { kind: "refund", status: "posted", amountKrw: 12_000, occurredOn: "2026-08-08" } },
    { cells: ["2026.08.09", "본인 1234-****-****-5678", "가상카페", "9,000", "", "81000007", "Y"], expect: { kind: "spend", status: "cancelled", amountKrw: 9_000, occurredOn: "2026-08-09" } },
    { cells: ["2026.08.10", "본인 1234-****-****-5678", "영원상점", "0", "", "81000008", ""], expect: { skip: "zero_amount" } },
    { cells: ["1999.12.31", "본인 1234-****-****-5678", "옛날상점", "1,000", "", "81000009", ""], expect: { skip: "bad_date" } },
    { cells: ["2027.01.15", "본인 1234-****-****-5678", "미래상점", "1,000", "", "81000010", ""], expect: { skip: "bad_date" } },
    { cells: ["합계", "", "", "211,400", "", "", ""], expect: { skip: "summary" } },
  ];
  const text = delimited([headers, ...rows.map(({ cells }) => cells)]);
  return fixture({ name: "shinhanCsvBom", issuer: "신한", filename: "신한.csv", bytes: new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(text)]), rows, expect: { sniff: "text", sheetCount: 1, sheetName: "Sheet1", headerRowIndex: 0, headers, mapping: { date: 0, cardNumber: 1, merchant: 2, amount: 3, installment: 4, approvalNo: 5, cancelFlag: 6 }, periodHint: null } });
}

/** 4행 파싱 · 환불 1 · 순지출 ₩40,500 · 건너뜀: 합계1. */
function samsungCp949(): StatementFixture {
  const headers = ["이용일", "가맹점", "이용금액", "할부", "승인번호"];
  const rows: AnnotatedRow[] = [
    { cells: ["12/28", "겨울상점", "20,000", "", "82000001"], expect: { kind: "spend", status: "posted", amountKrw: 20_000, occurredOn: "2025-12-28" } },
    { cells: ["01/03", "똠양꿍하우스", "24,500", "", "82000002"], expect: { kind: "spend", status: "posted", amountKrw: 24_500, occurredOn: "2026-01-03" } },
    { cells: ["01/04", "가상교통", "11,000", "", "82000003"], expect: { kind: "spend", status: "posted", amountKrw: 11_000, occurredOn: "2026-01-04" } },
    { cells: ["01/05", "가상환불", "-15,000", "", "82000004"], expect: { kind: "refund", status: "posted", amountKrw: 15_000, occurredOn: "2026-01-05" } },
    { cells: ["합계", "", "40,500", "", ""], expect: { skip: "summary" } },
  ];
  const text = delimited([["삼성카드 이용내역"], ["조회기간 : 2025.12.01 ~ 2026.01.31"], [], headers, ...rows.map(({ cells }) => cells)]);
  return fixture({ name: "samsungCp949", issuer: "삼성", filename: "삼성.csv", bytes: new Uint8Array(iconv.encode(text, "cp949")), rows, expect: { sniff: "text", sheetCount: 1, sheetName: "Sheet1", headerRowIndex: 3, headers, mapping: { date: 0, merchant: 1, amount: 2, installment: 3, approvalNo: 4 }, periodHint: { from: "2025-12-01", to: "2026-01-31" } } });
}

function excelSerial(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`) / 86_400_000 + 25_569;
}

/** 5행 파싱 · 순지출 ₩126,000. */
function hyundaiXlsx(): StatementFixture {
  const headers = ["이용일", "이용가맹점", "이용금액", "결제방법", "승인번호"];
  const rows: AnnotatedRow[] = Array.from({ length: 5 }, (_, index) => ({ cells: [excelSerial(`2026-08-0${index + 1}`), `가상가맹점${index + 1}`, [12_000, 18_000, 24_000, 32_000, 40_000][index], "일시불", `8300000${index + 1}`], expect: { kind: "spend", status: "posted", amountKrw: [12_000, 18_000, 24_000, 32_000, 40_000][index]!, occurredOn: `2026-08-0${index + 1}` } }));
  const bytes = workbookBytes([{ name: "안내", rows: [["이 파일은 합성 fixture입니다."], ["이용내역 시트를 확인하세요."]] }, { name: "국내이용내역", rows: [headers, ...rows.map(({ cells }) => cells)] }, { name: "해외이용내역", rows: [["이용일", "가맹점", "금액"], ["2026-08-02", "가상해외점", 12], ["2026-08-03", "가상해외점2", 15]] }], "xlsx");
  return fixture({ name: "hyundaiXlsx", issuer: "현대", filename: "현대.xlsx", bytes, rows, expect: { sniff: "xlsx", sheetCount: 3, sheetName: "국내이용내역", headerRowIndex: 0, headers, mapping: { date: 0, merchant: 1, amount: 2, installment: 3, approvalNo: 4 }, periodHint: null } });
}

/** 3행 파싱 · 취소 1 · 환불 1 · 순지출 ₩32,000. */
function kbHtmlXls(): StatementFixture {
  const headers = ["이용일시", "이용하신곳", "국내이용금액(원)", "해외이용금액", "결제방법", "승인번호", "상태"];
  const rows: AnnotatedRow[] = [
    { cells: ["2026.08.03 12:34", "가상식당", "32,000", "", "일시불", "00123456", "정상"], expect: { kind: "spend", status: "posted", amountKrw: 32_000, occurredOn: "2026-08-03" } },
    { cells: ["2026.08.04 13:10", "가상매장", "18,000", "", "일시불", "00123457", "취소"], expect: { kind: "spend", status: "cancelled", amountKrw: 18_000, occurredOn: "2026-08-04" } },
    { cells: ["2026.08.05 14:20", "가상서점", "-4,000", "", "일시불", "00123458", "부분취소"], expect: { kind: "refund", status: "posted", amountKrw: 4_000, occurredOn: "2026-08-05" } },
  ];
  const tr = (cells: unknown[], header = false) => `<tr>${cells.map((cell) => `<${header ? "th" : "td"}>${String(cell)}</${header ? "th" : "td"}>`).join("")}</tr>`;
  const html = `<html><head><meta charset="euc-kr"></head><body><table>${tr(headers, true)}${rows.map(({ cells }) => tr(cells)).join("")}</table></body></html>`;
  return fixture({ name: "kbHtmlXls", issuer: "국민", filename: "국민.xls", bytes: new Uint8Array(iconv.encode(html, "cp949")), rows, expect: { sniff: "html", sheetCount: 1, sheetName: "Sheet1", headerRowIndex: 0, headers, mapping: { date: 0, merchant: 1, amount: 2, foreignAmount: 3, installment: 4, approvalNo: 5, cancelFlag: 6 }, periodHint: null } });
}

/** 2행 파싱 · 순지출 ₩25,000 · 건너뜀: 빈 값1(완전히 빈 행은 집계 제외). */
function lotteUtf16Tsv(): StatementFixture {
  const headers = ["거래일자", "가맹점명", "이용금액", "할부기간"];
  const rows: AnnotatedRow[] = [
    { cells: ["2026-08-11", "가상편의점", "12,500", ""], expect: { kind: "spend", status: "posted", amountKrw: 12_500, occurredOn: "2026-08-11" } },
    { cells: ["2026-08-11", "가상편의점", "12,500", ""], expect: { kind: "spend", status: "posted", amountKrw: 12_500, occurredOn: "2026-08-11" } },
    { cells: [], expect: null },
    { cells: ["", "", "", "3"], expect: { skip: "blank" } },
  ];
  return fixture({ name: "lotteUtf16Tsv", issuer: "롯데", filename: "롯데.xls", bytes: utf16leBom(delimited([headers, ...rows.map(({ cells }) => cells)], "\t")), rows, expect: { sniff: "text", sheetCount: 1, sheetName: "Sheet1", headerRowIndex: 0, headers, mapping: { date: 0, merchant: 1, amount: 2, installment: 3 }, periodHint: null } });
}

/** 2행 파싱 · 해외 확정 1 · 순지출 ₩31,800. */
function hanaSpreadsheetMl(): StatementFixture {
  const headers = ["이용일자", "가맹점명", "이용금액", "해외이용금액", "통화코드", "승인번호"].map((value) => value.normalize("NFD"));
  const rows: AnnotatedRow[] = [
    { cells: ["2026-08-14", "가상해외점", "17,800", "12.50", "USD", "84000001"], expect: { kind: "spend", status: "posted", amountKrw: 17_800, occurredOn: "2026-08-14" } },
    { cells: ["2026-08-15", "가상상점", "14,000", "", "", "84000002"], expect: { kind: "spend", status: "posted", amountKrw: 14_000, occurredOn: "2026-08-15" } },
  ];
  return fixture({ name: "hanaSpreadsheetMl", issuer: "하나", filename: "하나.xls", bytes: workbookBytes([{ name: "이용내역", rows: [headers, ...rows.map(({ cells }) => cells)] }], "xlml"), rows, expect: { sniff: "xml", sheetCount: 1, sheetName: "이용내역", headerRowIndex: 0, headers: headers.map((value) => value.normalize("NFC")), mapping: { date: 0, merchant: 1, amount: 2, foreignAmount: 3, foreignCurrency: 4, approvalNo: 5 }, periodHint: null } });
}

/** 5행 파싱 · 순지출 ₩75,000. */
function hanaBiff8Xls(): StatementFixture {
  const headers = ["이용일자", "가맹점명", "이용금액", "승인번호"];
  const rows: AnnotatedRow[] = Array.from({ length: 5 }, (_, index) => ({ cells: [`2026-08-${String(index + 20).padStart(2, "0")}`, `가상매장${index + 1}`, (index + 1) * 5_000, `8500000${index + 1}`], expect: { kind: "spend", status: "posted", amountKrw: (index + 1) * 5_000, occurredOn: `2026-08-${String(index + 20).padStart(2, "0")}` } }));
  return fixture({ name: "hanaBiff8Xls", issuer: "하나", filename: "하나_구형.xls", bytes: workbookBytes([{ name: "이용내역", rows: [headers, ...rows.map(({ cells }) => cells)] }], "biff8"), rows, expect: { sniff: "xls", sheetCount: 1, sheetName: "이용내역", headerRowIndex: 0, headers, mapping: { date: 0, merchant: 1, amount: 2, approvalNo: 3 }, periodHint: null } });
}

function tableErrorFixtures(): StatementFixture[] {
  const billingHeaders = ["이용일자", "가맹점명", "이용금액", "회차", "청구금액", "잔여금액"];
  const bankHeaders = ["거래일시", "적요", "출금액", "입금액", "잔액", "거래점"];
  return [
    fixture({ name: "billingStatement", issuer: null, filename: "청구서.xlsx", bytes: workbookBytes([{ name: "청구내역", rows: [billingHeaders, ["2026-08-01", "가상매장", 10_000, 1, 5_000, 5_000]] }], "xlsx"), expect: { sniff: "xlsx", error: { stage: "table", code: "BILLING_STATEMENT" }, sheetCount: 1, sheetName: "청구내역", headerRowIndex: 0, headers: billingHeaders } }),
    fixture({ name: "bankStatement", issuer: null, filename: "은행.csv", bytes: utf8(delimited([bankHeaders, ["2026-08-01 10:00", "가상적요", 10_000, "", 90_000, "가상점"]])), expect: { sniff: "text", error: { stage: "table", code: "BANK_STATEMENT" }, sheetCount: 1, sheetName: "Sheet1", headerRowIndex: 0, headers: bankHeaders } }),
    fixture({ name: "noHeader", issuer: null, filename: "메모.csv", bytes: utf8("이번 달 기록\n카드 파일이 아닙니다\n열 제목이 없습니다"), expect: { sniff: "text", error: { stage: "table", code: "HEADER_NOT_FOUND" }, sheetCount: 1, sheetName: "Sheet1" } }),
  ];
}

function seededBytes(length: number): Uint8Array {
  let seed = 0x5eed1234;
  return Uint8Array.from({ length }, () => {
    seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
    return seed & 0xff;
  });
}

function encryptedBytes(): Uint8Array {
  // Community SheetJS cannot write encrypted workbooks. Build the two streams of an encrypted OOXML CFB container instead.
  const cfb = XLSX.CFB.utils.cfb_new();
  XLSX.CFB.utils.cfb_add(cfb, "/EncryptionInfo", Uint8Array.from([4, 0, 4, 0, 64, 0, 0, 0]));
  XLSX.CFB.utils.cfb_add(cfb, "/EncryptedPackage", Uint8Array.from([8, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4]));
  return new Uint8Array(XLSX.CFB.write(cfb, { type: "array" }));
}

function invalidFixtures(): StatementFixture[] {
  const random = seededBytes(96);
  return [
    fixture({ name: "tooManySheets", issuer: null, filename: "시트많음.xlsx", bytes: workbookBytes(Array.from({ length: 21 }, (_, index) => ({ name: `시트${index + 1}`, rows: [["값"], [index]] })), "xlsx"), expect: { sniff: "xlsx", error: { stage: "decode", code: "FILE_TOO_COMPLEX" }, sheetCount: 21 } }),
    fixture({ name: "encryptedXlsx", issuer: null, filename: "암호.xlsx", bytes: encryptedBytes(), expect: { error: { stage: "sniff", code: "ENCRYPTED_FILE" } } }),
    fixture({ name: "corruptXlsx", issuer: null, filename: "깨짐.xlsx", bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...random]), expect: { sniff: "xlsx", error: { stage: "decode", code: "CORRUPT_FILE" } } }),
    fixture({ name: "badEncoding", issuer: null, filename: "깨짐.csv", bytes: new Uint8Array([...utf8("이용일자,가맹점명,이용금액\n"), ...Array.from({ length: 64 }, (_, index) => index % 2 === 0 ? 0xff : 0x80)]), expect: { sniff: "text", error: { stage: "decode", code: "ENCODING_ERROR" } } }),
    fixture({ name: "pdfAsXls", issuer: null, filename: "card.xls", bytes: utf8("%PDF-1.7\nsynthetic fixture"), expect: { error: { stage: "sniff", code: "UNSUPPORTED_FORMAT" } } }),
    fixture({ name: "pngAsXlsx", issuer: null, filename: "card.xlsx", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...random.slice(0, 16)]), expect: { error: { stage: "sniff", code: "UNSUPPORTED_FORMAT" } } }),
    fixture({ name: "emptyCsv", issuer: null, filename: "empty.csv", bytes: new Uint8Array(), expect: { error: { stage: "sniff", code: "EMPTY_FILE" } } }),
  ];
}

function buildRegular(): StatementFixture[] {
  return [shinhanCsvBom(), samsungCp949(), hyundaiXlsx(), kbHtmlXls(), lotteUtf16Tsv(), hanaSpreadsheetMl(), hanaBiff8Xls(), ...tableErrorFixtures(), ...invalidFixtures()];
}

function heavyFixture(name: "tooManyRows" | "nearLimitRows", count: number): StatementFixture {
  const headers = ["이용일자", "가맹점명", "이용금액", "승인번호"];
  const lines = [headers.join(",")];
  const rows: AnnotatedRow[] = [];
  for (let index = 0; index < count; index += 1) {
    const day = String((index % 28) + 1).padStart(2, "0");
    lines.push(`2026-08-${day},가상매장,1000,${String(9_000_000 + index)}`);
    rows.push({ cells: [], expect: { kind: "spend", status: "posted", amountKrw: 1_000, occurredOn: `2026-08-${day}` } });
  }
  return fixture({ name, issuer: null, filename: name === "tooManyRows" ? "대량.csv" : "경계.csv", bytes: utf8(lines.join("\n")), rows: name === "nearLimitRows" ? rows : undefined, expect: { sniff: "text", ...(name === "tooManyRows" ? { error: { stage: "decode" as const, code: "TOO_MANY_ROWS" } } : {}), sheetCount: 1, sheetName: "Sheet1", headerRowIndex: 0, headers, mapping: { date: 0, merchant: 1, amount: 2, approvalNo: 3 }, periodHint: null } });
}

export function allFixtures(opts?: { heavy?: boolean }): StatementFixture[] {
  regularCache ??= buildRegular();
  if (!opts?.heavy) return regularCache;
  heavyCache ??= [...regularCache, heavyFixture("tooManyRows", 10_001), heavyFixture("nearLimitRows", 9_999)];
  return heavyCache;
}

export function getFixture(name: string): StatementFixture {
  const found = allFixtures({ heavy: name === "tooManyRows" || name === "nearLimitRows" }).find((item) => item.name === name);
  if (!found) throw new RangeError(`Unknown statement fixture: ${name}`);
  return found;
}

/** 각 3행 파싱 · 해외 1건은 미매입 추정액에서 같은 승인번호의 확정액으로 바뀐다. */
export function hyundaiForeignPair(): [pending: StatementFixture, confirmed: StatementFixture] {
  if (foreignPairCache) return foreignPairCache;
  const headers = ["이용일", "이용가맹점", "이용금액", "해외이용금액", "통화", "승인번호", "매입상태"];
  const mapping = { date: 0, merchant: 1, amount: 2, foreignAmount: 3, foreignCurrency: 4, approvalNo: 5, cancelFlag: 6 };
  const make = (confirmed: boolean): StatementFixture => {
    const rows: AnnotatedRow[] = [
      { cells: ["2026-08-20", "가상해외점", confirmed ? "17,812" : "17,650", "12.50", "USD", "86000001", confirmed ? "매입" : "미매입"], expect: { kind: "spend", status: confirmed ? "posted" : "pending", amountKrw: confirmed ? 17_812 : 17_650, occurredOn: "2026-08-20" } },
      { cells: ["2026-08-21", "가상국내점", "8,000", "", "", "86000002", "매입"], expect: { kind: "spend", status: "posted", amountKrw: 8_000, occurredOn: "2026-08-21" } },
      { cells: ["2026-08-22", "가상국내점2", "9,000", "", "", "86000003", "매입"], expect: { kind: "spend", status: "posted", amountKrw: 9_000, occurredOn: "2026-08-22" } },
    ];
    return fixture({ name: confirmed ? "hyundaiForeignConfirmed" : "hyundaiForeignPending", issuer: "현대", filename: confirmed ? "현대_해외_확정.xlsx" : "현대_해외_미매입.xlsx", bytes: workbookBytes([{ name: "해외이용내역", rows: [headers, ...rows.map(({ cells }) => cells)] }], "xlsx"), rows, expect: { sniff: "xlsx", sheetCount: 1, sheetName: "해외이용내역", headerRowIndex: 0, headers, mapping, periodHint: null } });
  };
  foreignPairCache = [make(false), make(true)];
  return foreignPairCache;
}
