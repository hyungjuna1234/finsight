import { describe, expect, it } from "vitest";

import { type KRW, type IsoDate } from "@/lib/domain/types";
import { getFixture, hyundaiForeignPair } from "@/test/fixtures/statements";

import { decodeFile } from "./decode";
import { identityKey } from "./identity";
import { parseRows } from "./parse";
import { sniffFile } from "./sniff";
import { detectTable } from "./table";

function parsed(name: string) {
  const fixture = name.startsWith("hyundaiForeign")
    ? hyundaiForeignPair()[name.endsWith("Pending") ? 0 : 1]
    : getFixture(name);
  const sniffed = sniffFile(fixture.bytes, fixture.filename);
  if (!sniffed.ok) throw new Error(sniffed.error);
  const decoded = decodeFile(fixture.bytes, sniffed.value);
  if (!decoded.ok) throw new Error(decoded.error);
  const table = detectTable(decoded.value);
  if (!table.ok || fixture.expect.headerRowIndex === undefined || !fixture.expect.mapping) throw new Error("fixture");
  return parseRows(table.value, { headerRowIndex: fixture.expect.headerRowIndex, columns: fixture.expect.mapping }, "2026-09-30" as IsoDate).rows;
}

function keys(rows: ReturnType<typeof parsed>, userId = "user-1", cardId = "card-1") {
  return rows.map((row) => identityKey({ userId, cardId, ...row }));
}

describe("identityKey", () => {
  it("keeps approval identities across pending and confirmed foreign amounts", () => {
    const pending = parsed("hyundaiForeignPending");
    const confirmed = parsed("hyundaiForeignConfirmed");
    expect(pending[0]).toMatchObject({ amountKrw: 17_650, status: "pending" });
    expect(confirmed[0]).toMatchObject({ amountKrw: 17_812, status: "posted" });
    expect(keys(pending)).toEqual(keys(confirmed));
  });

  it("separates repeated rows without approval numbers", () => {
    const rows = parsed("lotteUtf16Tsv");
    expect(rows.map((row) => row.occurrence)).toEqual([0, 1]);
    expect(new Set(keys(rows)).size).toBe(2);
  });

  it("separates distinct approval numbers and tenant/card scopes", () => {
    const rows = parsed("shinhanCsvBom").slice(0, 2);
    expect(new Set(keys(rows)).size).toBe(2);
    const base = { approvalNo: "A1", occurredOn: "2026-01-01" as IsoDate, kind: "spend" as const, merchantKey: "상점", amountKrw: 1_000 as KRW, occurrence: 0 };
    expect(identityKey({ userId: "u1", cardId: "c1", ...base })).not.toBe(identityKey({ userId: "u2", cardId: "c1", ...base }));
    expect(identityKey({ userId: "u1", cardId: "c1", ...base })).not.toBe(identityKey({ userId: "u1", cardId: "c2", ...base }));
  });

  it.each(["shinhanCsvBom", "samsungCp949", "hyundaiXlsx", "kbHtmlXls", "lotteUtf16Tsv", "hanaSpreadsheetMl", "hanaBiff8Xls"])("produces unique 64-char hashes for %s", (name) => {
    const result = keys(parsed(name));
    expect(result.every((key) => /^[a-f0-9]{64}$/.test(key))).toBe(true);
    expect(new Set(result).size).toBe(result.length);
  });
});
