import { describe, expect, it } from "vitest";

describe("test setup", () => {
  it("runs unit tests in the node environment", () => {
    expect(typeof window).toBe("undefined");
  });
});
