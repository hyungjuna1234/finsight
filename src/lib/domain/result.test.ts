import { describe, expect, it } from "vitest";

import { err, ok } from "./result";

describe("Result helpers", () => {
  it("성공 값을 만든다", () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it("오류 값을 만든다", () => {
    expect(err("NO_DATA")).toEqual({ ok: false, error: "NO_DATA" });
  });
});
