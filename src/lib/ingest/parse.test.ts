import { describe, expect, it } from "vitest";

import { parseAmountCell, parseDateCell } from "./parse";

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

describe("parseAmountCell", () => {
  it.each([
    ["1,234", 1234], ["1,234원", 1234], ["₩1,234", 1234], ["KRW 1,234", 1234],
    ["-1,234", -1234], ["1,234-", -1234], ["(1,234)", -1234],
    ["13,456.7", 13457], ["-13,456.7", -13457], ["예상 17,650", 17650], ["추정 미확정 100", 100],
    ["abc", null], ["", null], ["1,23", null],
  ])("parses %s", (raw, expected) => expect(parseAmountCell(raw)).toBe(expected));
});
