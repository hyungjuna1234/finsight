import { describe, expect, it } from "vitest";
import { makeTx } from "@/test/tx-factory";
import { groupByDate } from "./list";

describe("groupByDate", () => {
  it("sorts dates descending, preserves item order, and calculates net", () => {
    const a = makeTx({ occurredOn: "2026-09-25", amountKrw: 1000 });
    const b = makeTx({ occurredOn: "2026-09-26", amountKrw: 5000, kind: "refund" });
    const c = makeTx({ occurredOn: "2026-09-25", amountKrw: 9000, status: "cancelled" });
    const groups = groupByDate([a, b, c]);
    expect(groups.map((g) => [g.date, g.net])).toEqual([["2026-09-26", -5000], ["2026-09-25", 1000]]);
    expect(groups[1]?.items).toEqual([a, c]);
  });
});
