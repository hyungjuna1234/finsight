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
