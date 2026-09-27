import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import iconv from "iconv-lite";

import { allFixtures, getFixture, hyundaiForeignPair } from "./statements";

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function workbookHeaders(name: string): string[] {
  const fixture = getFixture(name);
  const workbook = XLSX.read(fixture.bytes, { type: "array", raw: true });
  const sheetName = fixture.expect.sheetName ?? workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new Error(`Missing sheet for ${name}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
  const index = fixture.expect.headerRowIndex ?? 0;
  return (rows[index] ?? []).map(String).map((value) => value.normalize("NFC"));
}

describe("statement fixture corpus", () => {
  it("uses unique names and only supported filename extensions", () => {
    const fixtures = allFixtures();
    expect(new Set(fixtures.map(({ name }) => name)).size).toBe(fixtures.length);
    for (const fixture of fixtures) expect(fixture.filename).toMatch(/\.(csv|xls|xlsx)$/i);
  });

  it("emits the specified text encodings and signatures", () => {
    expect(startsWith(getFixture("shinhanCsvBom").bytes, [0xef, 0xbb, 0xbf])).toBe(true);
    expect(startsWith(getFixture("lotteUtf16Tsv").bytes, [0xff, 0xfe])).toBe(true);

    const cp949 = getFixture("samsungCp949").bytes;
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(cp949)).toThrow();
    expect(iconv.decode(Buffer.from(cp949), "cp949")).toContain("똠양꿍하우스");

    const nfd = new TextDecoder().decode(getFixture("hanaSpreadsheetMl").bytes);
    expect(nfd).toContain("가맹점명");
    expect(nfd).not.toBe(nfd.normalize("NFC"));

    for (const name of ["hyundaiXlsx", "billingStatement", "tooManySheets"]) {
      expect(startsWith(getFixture(name).bytes, [0x50, 0x4b])).toBe(true);
    }
    expect(new TextDecoder().decode(getFixture("pdfAsXls").bytes.slice(0, 8))).toContain("%PDF");
  });

  it("builds an encrypted OOXML-like CFB container", () => {
    const bytes = getFixture("encryptedXlsx").bytes;
    expect(startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])).toBe(true);
    expect(Buffer.from(bytes).includes(Buffer.from("EncryptedPackage", "utf16le"))).toBe(true);
    expect(() => XLSX.read(bytes, { type: "array" })).toThrow(/password-protected/);
  });

  it.each([
    ["hyundaiXlsx", 3],
    ["hanaSpreadsheetMl", 1],
    ["hanaBiff8Xls", 1],
  ] as const)("round-trips %s with its expected sheets and headers", (name, count) => {
    const fixture = getFixture(name);
    const workbook = XLSX.read(fixture.bytes, { type: "array", raw: true });
    expect(workbook.SheetNames).toHaveLength(count);
    expect(workbookHeaders(name)).toEqual(fixture.expect.headers);
  });

  it("derives parsed totals from row expectations", () => {
    for (const fixture of allFixtures()) {
      const parsed = fixture.expect.parsed;
      if (!parsed) continue;
      expect(parsed.rows).toBe(parsed.spend + parsed.refund + parsed.cancelled);
      expect(parsed.pending).toBeLessThanOrEqual(parsed.rows);
      expect(parsed.period.from <= parsed.period.to).toBe(true);
    }

    expect(getFixture("shinhanCsvBom").expect.parsed).toEqual({
      rows: 7,
      spend: 5,
      refund: 1,
      cancelled: 1,
      pending: 0,
      netSpendKrw: 187_400,
      skipped: { zero_amount: 1, bad_date: 2, summary: 1 },
      period: { from: "2026-08-03", to: "2026-08-09" },
    });
  });

  it("creates the pending and confirmed foreign transaction pair", () => {
    const [pending, confirmed] = hyundaiForeignPair();
    expect(pending.expect.parsed?.pending).toBe(1);
    expect(confirmed.expect.parsed?.pending).toBe(0);
    expect(pending.expect.mapping).toEqual(confirmed.expect.mapping);
  });

  it("memoizes fixture bytes", () => {
    expect(allFixtures()).toBe(allFixtures());
    expect(getFixture("hyundaiXlsx")).toBe(getFixture("hyundaiXlsx"));
    expect(hyundaiForeignPair()).toBe(hyundaiForeignPair());
  });

  it("builds heavy boundary fixtures only on request", () => {
    expect(allFixtures().some(({ name }) => name === "tooManyRows")).toBe(false);
    const fixtures = allFixtures({ heavy: true });
    const tooMany = fixtures.find(({ name }) => name === "tooManyRows");
    const nearLimit = fixtures.find(({ name }) => name === "nearLimitRows");
    expect(new TextDecoder().decode(tooMany?.bytes).split("\n")).toHaveLength(10_002);
    expect(new TextDecoder().decode(nearLimit?.bytes).split("\n")).toHaveLength(10_000);
    expect(nearLimit?.expect.parsed?.rows).toBe(9_999);
  });
});
