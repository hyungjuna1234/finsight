import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vercel deployment configuration", () => {
  it("deploys in Seoul and runs cleanup daily at 03:00 KST", async () => {
    const config = JSON.parse(await readFile(resolve("vercel.json"), "utf8"));

    expect(config.regions).toEqual(["icn1"]);
    expect(config.crons).toEqual([
      { path: "/api/cron/cleanup", schedule: "0 18 * * *" },
    ]);
  });
});
