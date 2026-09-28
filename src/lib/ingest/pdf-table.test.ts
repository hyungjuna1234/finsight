import { describe, expect, it } from "vitest";

import { validateMapping } from "./mapping";
import { pdfTable, suggestPdfMapping, type PdfText } from "./pdf-table";

// 오른쪽 정렬 숫자: 글자 폭이 달라도 오른쪽 끝(x + width)이 같다.
function right(text: string, rightEdge: number, y: number): PdfText {
  const width = text.length * 4;
  return { text, x: rightEdge - width, y, width, height: 7.8 };
}
function left(text: string, x: number, y: number): PdfText {
  return { text, x, y, width: text.length * 5, height: 7.8 };
}
// NH 명세서와 같은 배치: "MM/DD 가맹점"이 한 조각, 이용금액·결제원금·수수료 열
function row(y: number, dateMerchant: string, amount: string, principal: string): PdfText[] {
  return [left(dateMerchant, 36, y), right(amount, 275.5, y), right(principal, 407, y), right("0", 445.5, y)];
}

const STATEMENT: PdfText[][] = [
  [
    left("9월 이용대금명세서", 400, 804),
    left("홍길동 귀하", 345, 648),
    left("결제일", 43, 591),
    left("2026년 09월 23일", 73, 591),
    right("1,234,500", 100, 515),
  ],
  [
    left("이용기간 : [일시불/할부] 2026.08.10 ~ 2026.09.09", 203, 815),
    ...row(771, "08/20 (주)학습지", "45,000", "45,000"),
    ...row(758, "08/29 김밥가게", "6,500", "6,500"),
    left("소계(A001)(홍길동)카드", 60, 656),
    [left("08/19 가나다학원", 36, 618), right("300,000", 275.5, 618), right("2/1", 345, 618), right("150,000", 407, 618), right("0", 445.5, 618)],
    ...row(605, "08/23 버거가게", "12,000", "11,640"),
  ].flat(),
  [
    ...row(770, "09/07 EXAMPLE* SUBSCRIPTION", "29,000", "29,000"),
    ...row(757, "09/09 공공기관_주차요금", "3,000", "3,000"),
    [left("합계", 60, 451), right("245,140", 407, 451)],
    [left("09/07", 36, 390), left("A002", 67, 390), left("EXAMPLE* SUB", 96, 390), left("USD", 218, 390), right("20.00", 300, 390), right("29,000", 460, 390)],
  ].flat(),
];

describe("pdfTable", () => {
  it("turns date-led lines into rows with right-aligned number columns", () => {
    const result = pdfTable(STATEMENT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const table = result.value;
    expect(table.headerRowIndex).toBe(0);
    expect(table.headers).toEqual(["이용일", "이용하신 곳", "열 3", "열 4", "열 5", "열 6"]);
    expect(table.sheetRows[0]).toEqual(table.headers);
    expect(table.dataRows).toEqual([
      ["08/20", "(주)학습지", "45,000", "", "45,000", "0"],
      ["08/29", "김밥가게", "6,500", "", "6,500", "0"],
      ["08/19", "가나다학원", "300,000", "2/1", "150,000", "0"],
      ["08/23", "버거가게", "12,000", "", "11,640", "0"],
      ["09/07", "EXAMPLE* SUBSCRIPTION", "29,000", "", "29,000", "0"],
      ["09/09", "공공기관_주차요금", "3,000", "", "3,000", "0"],
    ]);
  });

  it("stops at the grand total so a detail table below is not counted twice", () => {
    const result = pdfTable(STATEMENT);
    expect(result.ok && result.value.dataRows.some((cells) => cells.join(" ").includes("A002") || cells.includes("20.00"))).toBe(false);
  });

  it("reads the statement period from anywhere in the text", () => {
    const result = pdfTable(STATEMENT);
    expect(result.ok && result.value.periodHint).toEqual({ from: "2026-08-10", to: "2026-09-09" });
  });

  it("keeps personal details outside the table", () => {
    const result = pdfTable(STATEMENT);
    expect(result.ok && result.value.sheetRows.flat().some((cell) => cell.includes("홍길동") || cell.includes("명세서"))).toBe(false);
  });

  it("reads a date and merchant printed as separate pieces", () => {
    const result = pdfTable([[
      left("2026.08.03", 30, 700), left("12:31", 80, 700), left("스타", 120, 700), left("벅스 강남점", 130, 700), right("6,500", 300, 700),
      left("2026.08.04", 30, 690), left("CU 역삼역점", 120, 690), right("-1,200", 300, 690),
    ]]);
    expect(result.ok && result.value.dataRows).toEqual([
      ["2026.08.03", "스타벅스 강남점", "6,500"],
      ["2026.08.04", "CU 역삼역점", "-1,200"],
    ]);
  });

  it("groups pieces whose baselines differ slightly into one line", () => {
    const result = pdfTable([[left("08/01 편의점", 36, 700.4), right("1,000", 275.5, 699.6)]]);
    expect(result.ok && result.value.dataRows).toEqual([["08/01", "편의점", "1,000"]]);
  });

  it("ignores a total printed before any transaction", () => {
    const result = pdfTable([[left("합계", 40, 800), right("9,000", 275.5, 800), ...row(700, "08/01 편의점", "9,000", "9,000")]]);
    expect(result.ok && result.value.dataRows).toHaveLength(1);
  });

  it("skips date-led lines without a merchant or an amount", () => {
    const result = pdfTable([[
      left("2026.09.10", 98, 30), left("2026.09.10", 98, 30), left("다음페이지에 이어집니다", 438, 30),
      left("08/01", 36, 700), right("1,000", 275.5, 700),
      ...row(690, "08/02 편의점", "2,000", "2,000"),
    ]]);
    expect(result.ok && result.value.dataRows).toEqual([["08/02", "편의점", "2,000", "2,000", "0"]]);
  });

  it("fails when no transaction lines are found, as with a scanned PDF", () => {
    expect(pdfTable([[], [left("이용대금명세서", 100, 800)]])).toEqual({ ok: false, error: "PDF_NO_TRANSACTIONS" });
  });
});

describe("suggestPdfMapping", () => {
  it("picks the first number column as the amount (이용금액)", () => {
    const result = pdfTable(STATEMENT);
    if (!result.ok) throw new Error("table");
    const mapping = suggestPdfMapping(result.value);
    expect(mapping).toEqual({ headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2 } });
    expect(validateMapping(mapping!, result.value).ok).toBe(true);
  });

  it("skips a number column that does not hold amounts", () => {
    const result = pdfTable([[
      left("08/01 편의점", 36, 700), right("2/1", 200, 700), right("1,000", 275.5, 700),
      left("08/02 약국", 36, 690), right("3/1", 200, 690), right("2,000", 275.5, 690),
    ]]);
    if (!result.ok) throw new Error("table");
    expect(suggestPdfMapping(result.value)?.columns.amount).toBe(3);
  });
});
