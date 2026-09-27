import { describe, expect, it } from "vitest";

import type { IsoDate } from "@/lib/domain/types";
import { allFixtures, FIXTURE_TODAY, getFixture } from "@/test/fixtures/statements";

import { decodeFile } from "./decode";
import { sniffFile } from "./sniff";
import { detectTable, type TableGuess } from "./table";

import { parseAmountCell, parseDateCell, parseRows } from "./parse";

describe("parseDateCell", () => {
  it.each([
    ["2026-9-1", { year: 2026, month: 9, day: 1 }],
    ["2026.09.01 12:34:56", { year: 2026, month: 9, day: 1 }],
    ["20260901", { year: 2026, month: 9, day: 1 }],
    ["26.09.01 (화)", { year: 2026, month: 9, day: 1 }],
    ["2026년 9월 1일", { year: 2026, month: 9, day: 1 }],
    ["09/01", { year: null, month: 9, day: 1 }],
    ["9월 1일", { year: null, month: 9, day: 1 }],
    ["46266.9", { year: 2026, month: 9, day: 1 }],
    ["2026-02-30", null],
    ["abc", null],
    ["", null],
  ])("parses %s", (raw, expected) => expect(parseDateCell(raw)).toEqual(expected));
});

describe("parseRows", () => {
  for (const fixture of allFixtures({ heavy: true })) {
    if (!fixture.expect.parsed || fixture.expect.headerRowIndex === undefined || !fixture.expect.mapping) continue;
    const expected = fixture.expect.parsed;
    const headerRowIndex = fixture.expect.headerRowIndex;
    const columns = fixture.expect.mapping;
    it(`matches parsed expectations for ${fixture.name}`, () => {
      const sniffed = sniffFile(fixture.bytes, fixture.filename);
      expect(sniffed.ok).toBe(true);
      if (!sniffed.ok) return;
      const decoded = decodeFile(fixture.bytes, sniffed.value);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) return;
      const detected = detectTable(decoded.value);
      expect(detected.ok).toBe(true);
      if (!detected.ok) return;
      const result = parseRows(detected.value, { headerRowIndex, columns }, FIXTURE_TODAY);
      const active = result.rows.filter((row) => row.status !== "cancelled");
      const skipped = Object.fromEntries([...new Set(result.skipped.map(({ reason }) => reason))].map((reason) => [reason, result.skipped.filter((row) => row.reason === reason).length]));
      expect({
        rows: result.rows.length,
        spend: active.filter((row) => row.kind === "spend").length,
        refund: active.filter((row) => row.kind === "refund").length,
        cancelled: result.rows.filter((row) => row.status === "cancelled").length,
        pending: result.rows.filter((row) => row.status === "pending").length,
        netSpendKrw: active.reduce((sum, row) => sum + (row.kind === "spend" ? row.amountKrw : -row.amountKrw), 0),
        skipped,
        period: result.period,
      }).toEqual(expected);
    });
  }

  it("uses the previous year for an unhinted future month and parses card/status details", () => {
    const table: TableGuess = {
      sheetName: "표", sheetRows: [], headerRowIndex: 0,
      headers: ["이용일", "가맹점", "금액", "매입여부", "카드번호"],
      dataRows: [["12/31", "상점", "1,000", "Y", "1234-5678-9012-3456"]], periodHint: null,
    };
    const result = parseRows(table, { headerRowIndex: 0, columns: { date: 0, merchant: 1, amount: 2, cancelFlag: 3, cardNumber: 4 } }, "2026-01-01" as IsoDate);
    expect(result.rows[0]).toMatchObject({ occurredOn: "2025-12-31", status: "posted", cardLast4: "3456" });
  });

  it("masks long digit tokens in merchantRaw and parses Excel serial dates", () => {
    const fixture = getFixture("shinhanCsvBom");
    const sniffed = sniffFile(fixture.bytes, fixture.filename);
    if (!sniffed.ok) throw new Error(sniffed.error);
    const decoded = decodeFile(fixture.bytes, sniffed.value);
    if (!decoded.ok) throw new Error(decoded.error);
    const table = detectTable(decoded.value);
    if (!table.ok || !fixture.expect.mapping) throw new Error("fixture");
    const result = parseRows(table.value, { headerRowIndex: 0, columns: fixture.expect.mapping }, FIXTURE_TODAY);
    expect(result.rows.find((row) => row.merchantRaw.startsWith("스마트"))?.merchantRaw).toBe("스마트스토어 #");
    expect(result.rows[0]?.cardLast4).toBe("5678");
  });
});

describe("parseAmountCell", () => {
  it.each([
    ["1,234", 1234], ["1,234원", 1234], ["₩1,234", 1234], ["KRW 1,234", 1234],
    ["-1,234", -1234], ["1,234-", -1234], ["(1,234)", -1234],
    ["13,456.7", 13457], ["-13,456.7", -13457], ["예상 17,650", 17650], ["추정 미확정 100", 100],
    ["abc", null], ["", null], ["1,23", null],
  ])("parses %s", (raw, expected) => expect(parseAmountCell(raw)).toBe(expected));
});
