import { describe, expect, it } from "vitest";
import { BUSINESS_INFO, EFFECTIVE_DATE, LEGAL_DRAFT_NOTICE } from "./legal";

describe("legal draft constants", () => {
  it("keeps every required value non-empty", () => {
    expect(LEGAL_DRAFT_NOTICE).toBeTruthy();
    expect(EFFECTIVE_DATE).toBeTruthy();
    expect(Object.values(BUSINESS_INFO)).toHaveLength(7);
    expect(Object.values(BUSINESS_INFO).every((value) => value.trim().length > 0)).toBe(true);
  });
});
