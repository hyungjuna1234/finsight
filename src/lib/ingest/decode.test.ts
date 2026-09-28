import { allFixtures, getFixture } from "@/test/fixtures/statements";
import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { decodeFile, decodeText, normalizeCell, parseDelimited, sniffDelimiter } from "./decode";
import { sniffFile, type Sniff } from "./sniff";

function sniffFixture(name: string): { bytes: Uint8Array; sniff: Sniff } {
  const fixture = getFixture(name);
  const sniffed = sniffFile(fixture.bytes, fixture.filename);
  if (!sniffed.ok) throw new Error(`fixture did not sniff: ${name}`);
  return { bytes: fixture.bytes, sniff: sniffed.value };
}

describe("decodeFile", () => {
  it("ignores a mismatched EUC-KR declaration in UTF-8 HTML", () => {
    const html = '<html><head><meta charset="euc-kr"></head><body><table><tr><td>한글</td></tr></table></body></html>';
    const decoded = decodeFile(new TextEncoder().encode(html), {
      kind: "html",
      extension: "xls",
      encoding: null,
    });

    expect(decoded.ok && decoded.value[0]?.rows[0]?.[0]).toBe("한글");
  });

  it("ignores a mismatched UTF-8 declaration in CP949 HTML", () => {
    const html = '<html><head><meta charset="utf-8"></head><body><table><tr><td>한글</td></tr></table></body></html>';
    const decoded = decodeFile(new Uint8Array(iconv.encode(html, "cp949")), {
      kind: "html",
      extension: "xls",
      encoding: null,
    });

    expect(decoded.ok && decoded.value[0]?.rows[0]?.[0]).toBe("한글");
  });

  it("formats built-in and explicit short dates as ISO dates", () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [{ t: "n", v: 45574, z: XLSX.SSF.get_table()[14] }],
      [{ t: "n", v: 45580, z: "m/d/yy" }],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "이용내역");
    const bytes = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));

    const decoded = decodeFile(bytes, { kind: "xlsx", extension: "xlsx", encoding: null });

    expect(decoded.ok && decoded.value[0]?.rows).toEqual([
      ["2024-10-09"],
      ["2024-10-15"],
    ]);
  });

  for (const fixture of allFixtures({ heavy: true })) {
    if (fixture.expect.error?.stage === "decode") {
      it(`rejects ${fixture.name} with ${fixture.expect.error.code}`, () => {
        const sniffed = sniffFile(fixture.bytes, fixture.filename);
        expect(sniffed.ok).toBe(true);
        if (!sniffed.ok) return;
        expect(decodeFile(fixture.bytes, sniffed.value)).toEqual({
          ok: false,
          error: fixture.expect.error?.code,
        });
      });
      continue;
    }
    if (!fixture.expect.sheetCount || !fixture.expect.sheetName || fixture.expect.headerRowIndex === undefined || !fixture.expect.headers) continue;
    const { sheetCount, sheetName, headers } = fixture.expect;

    it(`decodes ${fixture.name}`, () => {
      const headerRowIndex = fixture.expect.headerRowIndex;
      if (headerRowIndex === undefined) throw new Error("fixture header row is missing");
      const sniffed = sniffFile(fixture.bytes, fixture.filename);
      expect(sniffed.ok).toBe(true);
      if (!sniffed.ok) return;
      const decoded = decodeFile(fixture.bytes, sniffed.value);
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) return;
      expect(decoded.value).toHaveLength(sheetCount);
      const sheet = decoded.value.find(({ name }) => name === sheetName);
      expect(sheet?.rows[headerRowIndex]).toEqual(headers);
    });
  }

  it("restores CP949 extension characters", () => {
    const { bytes, sniff } = sniffFixture("samsungCp949");
    const decoded = decodeFile(bytes, sniff);
    expect(decoded.ok && decoded.value[0]?.rows.flat()).toContain("똠양꿍하우스");
  });

  it("preserves leading zeroes in HTML spreadsheet cells", () => {
    const { bytes, sniff } = sniffFixture("kbHtmlXls");
    const decoded = decodeFile(bytes, sniff);
    expect(decoded.ok && decoded.value[0]?.rows.flat()).toContain("00123456");
  });

  it("maps legacy encrypted workbook errors", () => {
    const fixture = getFixture("encryptedXlsx");
    expect(decodeFile(fixture.bytes, { kind: "xls", extension: "xls", encoding: null })).toEqual({
      ok: false,
      error: "ENCRYPTED_FILE",
    });
  });
});

describe("text decoding and delimited parsing", () => {
  it("parses quoted delimiters, escaped quotes and embedded newlines", () => {
    expect(parseDelimited('a,"b,c","d""e"\r\n1,"two\nlines",3\r\n', ",")).toEqual([
      ["a", "b,c", 'd"e'],
      ["1", "two\nlines", "3"],
    ]);
  });

  it("detects tabs using consistent non-empty lines", () => {
    expect(sniffDelimiter("a\tb\tc\n1\t2\t3\n4\t5\t6")).toBe("\t");
  });

  it("normalizes and truncates cells", () => {
    expect(normalizeCell(`  가\u00a0${"x".repeat(600)}  `)).toBe(`가 ${"x".repeat(498)}`);
    expect(normalizeCell(null)).toBe("");
  });

  it("rejects badly decoded CP949 fallback output", () => {
    const bytes = Uint8Array.from(Array.from({ length: 40 }, (_, index) => index % 2 ? 0x80 : 0xff));
    expect(decodeText(bytes, null)).toEqual({ ok: false, error: "ENCODING_ERROR" });
  });
});
