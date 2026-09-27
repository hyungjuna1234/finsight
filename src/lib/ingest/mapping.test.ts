import { describe, expect, it } from "vitest";

import { allFixtures } from "@/test/fixtures/statements";

import { decodeFile } from "./decode";
import { headerSignature, validateMapping, type ColumnMapping } from "./mapping";
import { sniffFile } from "./sniff";
import { detectTable } from "./table";

describe("validateMapping", () => {
  for (const fixture of allFixtures()) {
    if (!fixture.expect.mapping || fixture.expect.error) continue;
    const expectedMapping = fixture.expect.mapping;
    it(`validates ${fixture.name}`, () => {
      const sniffed = sniffFile(fixture.bytes, fixture.filename);
      if (!sniffed.ok) throw new Error(sniffed.error);
      const decoded = decodeFile(fixture.bytes, sniffed.value);
      if (!decoded.ok) throw new Error(decoded.error);
      const table = detectTable(decoded.value);
      if (!table.ok) throw new Error(table.error);
      const mapping: ColumnMapping = { headerRowIndex: fixture.expect.headerRowIndex!, columns: expectedMapping };
      expect(validateMapping(mapping, table.value)).toEqual({ ok: true, value: mapping });

      expect(validateMapping({ ...mapping, columns: { ...mapping.columns, date: mapping.columns.merchant, merchant: mapping.columns.date } }, table.value).ok).toBe(false);
      expect(validateMapping({ ...mapping, columns: { ...mapping.columns, amount: 99 } }, table.value).ok).toBe(false);
      expect(validateMapping({ ...mapping, columns: { ...mapping.columns, merchant: mapping.columns.date } }, table.value).ok).toBe(false);
    });
  }
});

describe("headerSignature", () => {
  it("is stable across whitespace, normalization and case but changes with order", () => {
    const first = headerSignature([" 이용 일자 ", "ＡＭＯＵＮＴ", ""]);
    expect(headerSignature(["이용일자", "amount"])).toBe(first);
    expect(headerSignature(["amount", "이용일자"])).not.toBe(first);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });
});
