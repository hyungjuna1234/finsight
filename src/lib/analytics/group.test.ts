import { describe, expect, it } from "vitest";
import { groupSpending, toSearchRows } from "./group";
import type { TxView } from "@/lib/domain/types";

const tx = (overrides: Partial<TxView> = {}): TxView => ({ id: "1", cardId: null, occurredOn: "2026-09-01" as never, merchantRaw: "가맹점", merchantKey: "merchant", amountKrw: 1000 as never, kind: "spend", status: "posted", category: "식비", categorySource: "rule", installmentMonths: null, foreignAmount: null, foreignCurrency: null, ...overrides });

describe("groupSpending", () => {
  it("excludes cancelled rows, subtracts refunds and sorts by amount", () => {
    const rows = [tx({ amountKrw: 5000 as never }), tx({ id: "2", amountKrw: 1000 as never, kind: "refund" }), tx({ id: "3", category: "교통", amountKrw: 6000 as never }), tx({ id: "4", category: "쇼핑", amountKrw: 9999 as never, status: "cancelled" })];
    expect(groupSpending(rows, "category")).toEqual([
      { key: "교통", label: "교통", amount: 6000, count: 1 },
      { key: "식비", label: "식비", amount: 4000, count: 2 },
    ]);
  });

  it("groups by month and merchant label and caps output at thirty", () => {
    expect(groupSpending([tx()], "month")[0]?.key).toBe("2026-09");
    expect(groupSpending([tx({ merchantRaw: "표시명" })], "merchant")[0]?.label).toBe("표시명");
    const many = Array.from({ length: 35 }, (_, index) => tx({ id: String(index), category: "식비", merchantKey: `m${index}`, merchantRaw: `상점${index}`, amountKrw: (100 + index) as never }));
    expect(groupSpending(many, "merchant", 99)).toHaveLength(30);
  });
});

describe("toSearchRows", () => {
  it("returns at most thirty non-cancelled, compact rows", () => {
    const rows = Array.from({ length: 35 }, (_, index) => tx({ id: String(index), status: index === 0 ? "cancelled" : index === 1 ? "pending" : "posted" }));
    const result = toSearchRows(rows, 99);
    expect(result).toHaveLength(30);
    expect(result[0]).toEqual({ date: "2026-09-01", merchant: "가맹점", amount: 1000, kind: "spend", category: "식비", estimated: true });
  });
});
