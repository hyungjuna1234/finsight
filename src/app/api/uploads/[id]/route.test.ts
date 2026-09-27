import { describe, expect, it } from "vitest";
import { DELETE } from "./route";
describe("delete route", () => { it("exports DELETE", () => expect(DELETE).toBeTypeOf("function")); });
