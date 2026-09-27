import { describe, expect, it } from "vitest";

import {
  ACCEPT_ATTR,
  ACCEPTED_EXTENSIONS,
  UPLOAD_LIMITS,
  checkUploadFile,
  fileExtension,
} from "./upload";

describe("upload file limits", () => {
  it.each([
    ["statement.csv", "csv"],
    ["statement.XLS", "xls"],
    ["archive.card.XlSx", "xlsx"],
    ["statement.pdf", null],
    ["statement", null],
    ["statement.csv.exe", null],
  ])("extracts the accepted extension from %s", (filename, expected) => {
    expect(fileExtension(filename)).toBe(expected);
  });

  it("publishes the browser accept value", () => {
    expect(ACCEPTED_EXTENSIONS).toEqual(["csv", "xls", "xlsx"]);
    expect(ACCEPT_ATTR).toBe(
      ".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it.each([
    [{ name: "statement.csv", size: UPLOAD_LIMITS.maxBytes }, null],
    [{ name: "statement.csv", size: UPLOAD_LIMITS.maxBytes + 1 }, "FILE_TOO_LARGE"],
    [{ name: "statement.pdf", size: 1 }, "UNSUPPORTED_FORMAT"],
    [{ name: "statement.xlsx", size: 0 }, "EMPTY_FILE"],
  ] as const)("checks $0", (file, expected) => {
    expect(checkUploadFile(file)).toBe(expected);
  });
});
