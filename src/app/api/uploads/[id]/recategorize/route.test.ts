import { describe, expect, it } from "vitest";
import { maxDuration } from "./route";
describe("recategorize route", () => { it("has a 120 second limit", () => expect(maxDuration).toBe(120)); });
