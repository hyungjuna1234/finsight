import { describe, expect, it } from "vitest";
import { maxDuration } from "./route";
describe("analyze route", () => { it("has a 60 second limit", () => expect(maxDuration).toBe(60)); });
