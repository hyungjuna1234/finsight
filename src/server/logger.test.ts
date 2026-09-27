import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "./logger";

describe("SafeLogger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs only an error name and code, without sensitive database details", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.error(
      "database.failed",
      {
        name: "PostgrestError",
        code: "23505",
        message: "duplicate key for 스타벅스",
        details: "Failing row contains (스타벅스, 5000)",
        hint: "가맹점과 금액을 확인하세요",
        stack: "secret stack",
      },
      { uploadId: "upload-1" },
    );

    expect(spy).toHaveBeenCalledOnce();
    const output = String(spy.mock.calls[0]?.[0]);
    expect(JSON.parse(output)).toEqual({
      level: "error",
      event: "database.failed",
      uploadId: "upload-1",
      error: { name: "PostgrestError", code: "23505" },
    });
    expect(output).not.toContain("스타벅스");
    expect(output).not.toContain("5000");
    expect(output).not.toContain("secret stack");
  });

  it("truncates string fields to 200 characters", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logger.info("upload.checked", { id: "a".repeat(250), count: 3 });

    const output = String(spy.mock.calls[0]?.[0]);
    expect(JSON.parse(output)).toMatchObject({ id: "a".repeat(200), count: 3 });
  });
});
