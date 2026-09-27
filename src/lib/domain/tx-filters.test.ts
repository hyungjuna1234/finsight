import { describe, expect, it } from "vitest";
import { escapeLike, parseTxFilters, toTxFilterQuery } from "./tx-filters";

describe("transaction filters", () => {
  it("parses valid first values and normalizes query", () => {
    expect(parseTxFilters({ month: ["2026-09", "2025-01"], category: "식비", cardId: "550e8400-e29b-41d4-a716-446655440000", q: "  카페  ", cursor: "100" })).toEqual({ month: "2026-09", category: "식비", cardId: "550e8400-e29b-41d4-a716-446655440000", q: "카페", cursor: 100 });
  });
  it("quietly rejects invalid values", () => {
    expect(parseTxFilters({ month: "2026-13", category: "나쁨", cardId: "x", q: " ", cursor: "-1" })).toEqual({ month: null, category: null, cardId: null, q: null, cursor: 0 });
  });
  it("serializes only meaningful values and escapes LIKE metacharacters", () => {
    expect(toTxFilterQuery({ month: "2026-09" as never, q: "커피 %" })).toBe("?month=2026-09&q=%EC%BB%A4%ED%94%BC+%25");
    expect(escapeLike("a%_\\b")).toBe("a\\%\\_\\\\b");
  });
});
