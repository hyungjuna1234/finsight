import { describe, expect, it } from "vitest";

import { allFixtures } from "@/test/fixtures/statements";

import { decodeFile } from "./decode";
import { sniffFile } from "./sniff";
import { detectTable, isSummaryRow, periodHintFromText, tableAtHeader, type TableGuess } from "./table";

describe("detectTable", () => {
  for (const fixture of allFixtures()) {
    if (fixture.expect.headerRowIndex === undefined) continue;
    it(`detects ${fixture.name}`, () => {
      const sniffed = sniffFile(fixture.bytes, fixture.filename);
      expect(sniffed.ok).toBe(true);
      if (!sniffed.ok) return;
      const decoded = decodeFile(fixture.bytes, sniffed.value);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) return;
      const detected = detectTable(decoded.value);
      const expectedError = fixture.expect.error?.stage === "table" ? fixture.expect.error.code : null;
      if (expectedError) {
        expect(detected).toEqual({ ok: false, error: expectedError });
        return;
      }
      expect(detected.ok).toBe(true);
      if (!detected.ok) return;
      expect(detected.value).toMatchObject({
        sheetName: fixture.expect.sheetName,
        headerRowIndex: fixture.expect.headerRowIndex,
        headers: fixture.expect.headers,
        periodHint: fixture.expect.periodHint,
      });
    });
  }

  it("returns HEADER_NOT_FOUND when no candidate exists", () => {
    expect(detectTable([{ name: "메모", rows: [["제목"], [], ["값", "뿐"]] }])).toEqual({
      ok: false,
      error: "HEADER_NOT_FOUND",
    });
  });

  it("prefers the table with more non-empty data rows and pads rows", () => {
    const detected = detectTable([
      { name: "작은표", rows: [["이용일", "가맹점", "금액"], ["2026-01-01", "가게", "1000"]] },
      { name: "큰표", rows: [["제목"], [], ["이용일", "가맹점", "금액", "승인번호"], ["2026-01-01", "가게", "1000"], [], ["2026-01-02", "상점", "2000", "1"]] },
    ]);
    expect(detected.ok && detected.value).toMatchObject({
      sheetName: "큰표",
      headerRowIndex: 2,
      dataRows: [["2026-01-01", "가게", "1000", ""], ["2026-01-02", "상점", "2000", "1"]],
    });
  });
});

describe("table helpers", () => {
  it.each([["합계"], [" 소 계 123"], ["총계"], ["총 합 계"], ["TOTAL amount"]])("recognizes summary rows", (...cells) => {
    expect(isSummaryRow(cells)).toBe(true);
  });

  it("re-slices at a valid header and rejects boundaries", () => {
    const base: TableGuess = { sheetName: "표", sheetRows: [["제목"], ["이용일", "가맹점", "금액"], ["2026-01-01", "가게"]], headerRowIndex: 1, headers: ["이용일", "가맹점", "금액"], dataRows: [], periodHint: null };
    expect(tableAtHeader(base, 1)?.dataRows).toEqual([["2026-01-01", "가게", ""]]);
    expect(tableAtHeader(base, -1)).toBeNull();
    expect(tableAtHeader(base, 3)).toBeNull();
  });

  it("reads the statement period from free text", () => {
    expect(periodHintFromText("이용기간 : [일시불/할부] 2026.08.10 ~ 2026.09.09 [현금서비스] 2026.07.25 ~ 2026.08.24")).toEqual({ from: "2026-08-10", to: "2026-09-09" });
    expect(periodHintFromText("2026년 8월 1일 ~ 2026년 8월 31일")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(periodHintFromText("2026.09.10 ~ 2026.08.01")).toBeNull();
    expect(periodHintFromText("결제일 2026.09.23")).toBeNull();
  });
});
