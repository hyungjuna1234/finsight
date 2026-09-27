import { allFixtures } from "@/test/fixtures/statements";
import { describe, expect, it } from "vitest";

import { sniffFile } from "./sniff";

describe("sniffFile", () => {
  for (const fixture of allFixtures()) {
    if (fixture.expect.sniff) {
      it(`detects ${fixture.name} as ${fixture.expect.sniff}`, () => {
        const result = sniffFile(fixture.bytes, fixture.filename);
        expect(result.ok && result.value.kind).toBe(fixture.expect.sniff);
      });
    }
    if (fixture.expect.error?.stage === "sniff") {
      it(`rejects ${fixture.name} with ${fixture.expect.error.code}`, () => {
        expect(sniffFile(fixture.bytes, fixture.filename)).toEqual({
          ok: false,
          error: fixture.expect.error?.code,
        });
      });
    }
  }

  it.each(["statement.pdf", "statement.txt"])("rejects the %s extension", (filename) => {
    expect(sniffFile(new TextEncoder().encode("date,amount"), filename)).toEqual({
      ok: false,
      error: "UNSUPPORTED_FORMAT",
    });
  });

  it("treats BOM and whitespace only as empty", () => {
    expect(sniffFile(Uint8Array.from([0xef, 0xbb, 0xbf, 0x20, 0x0a, 0x09]), "empty.csv")).toEqual({
      ok: false,
      error: "EMPTY_FILE",
    });
  });
});
