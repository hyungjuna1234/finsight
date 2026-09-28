import { syntheticPdf } from "@/test/fixtures/pdf";
import { describe, expect, it } from "vitest";

import { PDF_LIMITS, readPdf } from "./pdf";

const PAGE = [
  { text: "08/20 STARBUCKS", x: 36, y: 770 },
  { text: "12,900", x: 250, y: 770 },
  { text: "08/21 GS25", x: 36, y: 757 },
  { text: "3,000", x: 254, y: 757 },
];

describe("readPdf", () => {
  it("returns the text items of each page with positions", async () => {
    const result = await readPdf(syntheticPdf([PAGE, [{ text: "TOTAL", x: 60, y: 400 }]]), null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[0]!.map((item) => item.text)).toEqual(["08/20 STARBUCKS", "12,900", "08/21 GS25", "3,000"]);
    const amount = result.value[0]![1]!;
    expect(amount.x).toBeCloseTo(250);
    expect(amount.y).toBeCloseTo(770);
    expect(amount.width).toBeGreaterThan(10);
    expect(amount.height).toBeGreaterThan(0);
  });

  it("asks for a password when the PDF is encrypted", async () => {
    expect(await readPdf(syntheticPdf([PAGE], { password: "0" }), null)).toEqual({ ok: false, error: "PDF_PASSWORD_REQUIRED" });
  });

  it("rejects a wrong password", async () => {
    expect(await readPdf(syntheticPdf([PAGE], { password: "0" }), "900101")).toEqual({ ok: false, error: "PDF_PASSWORD_WRONG" });
  });

  it("opens an encrypted PDF with the right password", async () => {
    const result = await readPdf(syntheticPdf([PAGE], { password: "900101" }), "900101");
    expect(result.ok && result.value[0]!.map((item) => item.text)).toEqual(["08/20 STARBUCKS", "12,900", "08/21 GS25", "3,000"]);
  });

  it("ignores a password for a PDF without one", async () => {
    const result = await readPdf(syntheticPdf([PAGE]), "900101");
    expect(result.ok).toBe(true);
  });

  it("leaves the caller's bytes usable", async () => {
    const bytes = syntheticPdf([PAGE]);
    const length = bytes.length;
    await readPdf(bytes, null);
    expect(bytes.length).toBe(length);
    expect(bytes[0]).toBe(0x25);
  });

  it("reports a broken PDF as corrupt", async () => {
    expect(await readPdf(new TextEncoder().encode("%PDF-1.7\nnot really a pdf"), null)).toEqual({ ok: false, error: "CORRUPT_FILE" });
  });

  it("rejects PDFs with too many pages", async () => {
    const pages = Array.from({ length: PDF_LIMITS.maxPages + 1 }, () => [{ text: "x", x: 10, y: 10 }]);
    expect(await readPdf(syntheticPdf(pages), null)).toEqual({ ok: false, error: "FILE_TOO_COMPLEX" });
  });
});
