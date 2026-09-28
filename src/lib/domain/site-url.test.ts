import { describe, expect, it } from "vitest";
import { parseSiteUrl } from "./site-url";

describe("parseSiteUrl", () => {
  it("returns a URL for an http(s) origin", () => {
    expect(parseSiteUrl("https://finsight.example")?.origin).toBe("https://finsight.example");
  });

  it("returns undefined when the value is missing or invalid", () => {
    expect(parseSiteUrl(undefined)).toBeUndefined();
    expect(parseSiteUrl("")).toBeUndefined();
    expect(parseSiteUrl("not a url")).toBeUndefined();
    expect(parseSiteUrl("javascript:alert(1)")).toBeUndefined();
  });
});
