import { describe, expect, it } from "vitest";
import { analyzeUploadBody } from "@/server/actions/uploads";
import { maxDuration } from "./route";
describe("analyze route", () => { it("has a 60 second limit", () => expect(maxDuration).toBe(60)); it("takes only an optional PDF password", () => { expect(analyzeUploadBody.safeParse({ password: "0" }).success).toBe(true); expect(analyzeUploadBody.safeParse({ mapping: {} }).success).toBe(false); }); });
