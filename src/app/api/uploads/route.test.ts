import { describe, expect, it } from "vitest";
import { createUploadBody } from "@/server/actions/uploads";

describe("upload route body", () => { it("rejects caller identity", () => expect(createUploadBody.safeParse({ filename: "a.csv", size: 1, sha256: "a".repeat(64), userId: "x" }).success).toBe(false)); });
