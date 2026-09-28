import { describe, expect, it } from "vitest";

import { CONSENT_ITEMS, CONSENT_VERSION, missingConsents } from "./consent";

describe("consent domain", () => {
  it("defines four separate required consent items", () => {
    expect(CONSENT_ITEMS.map(({ kind }) => kind)).toEqual([
      "privacy",
      "overseas_transfer",
      "terms",
      "age14",
    ]);
    expect(new Set(CONSENT_ITEMS.map(({ kind }) => kind)).size).toBe(4);
  });

  it("discloses the capped chat transaction transfer and excludes card numbers", () => {
    const overseasTransfer = CONSENT_ITEMS.find(({ kind }) => kind === "overseas_transfer");

    expect(overseasTransfer?.summary).toContain("최대 30건");
    expect(overseasTransfer?.summary).toContain("카드번호는 보내지 않아요");
  });

  it("accepts only agreements from the current version", () => {
    expect(missingConsents([
      { kind: "privacy", version: CONSENT_VERSION },
      { kind: "overseas_transfer", version: "2025-01" },
      { kind: "terms", version: CONSENT_VERSION },
      { kind: "age14", version: CONSENT_VERSION },
      { kind: "unknown", version: CONSENT_VERSION },
    ])).toEqual(["overseas_transfer"]);
  });
});
