import { readFile } from "node:fs/promises";
import { CATEGORIES } from "../../src/lib/domain/categories";
import { describe, expect, it } from "vitest";

describe("transaction categories", () => {
  it("keeps the migration CHECK synchronized with CATEGORIES", async () => {
    const sql = await readFile(
      new URL("../migrations/20260926000000_init.sql", import.meta.url),
      "utf8",
    );
    const transactions = sql.match(/create table public\.transactions \([\s\S]*?\n\);/)?.[0];
    const values = transactions
      ?.match(/category text not null check \(category in \(([^)]+)\)\)/)?.[1]
      ?.match(/'([^']+)'/g)
      ?.map((value) => value.slice(1, -1));

    expect(values).toEqual([...CATEGORIES]);
  });
});
