import { describe, expect, it } from "vitest";
import { clientIp } from "./request";

describe("clientIp", () => {
  it("uses the first valid forwarded address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-real-ip": "198.51.100.2" }))).toBe("203.0.113.7");
  });
  it("falls back to a valid real IP and rejects invalid values", () => {
    expect(clientIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(new Headers({ "x-forwarded-for": "not-an-ip", "x-real-ip": "also-bad" }))).toBeNull();
  });
});
