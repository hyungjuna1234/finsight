import { toKRW } from "@/lib/domain/money";
import type { IsoDate, KRW, TxView } from "@/lib/domain/types";

let sequence = 0;

type TxOverrides = Omit<Partial<TxView>, "occurredOn" | "amountKrw"> & {
  occurredOn?: IsoDate | string;
  amountKrw?: KRW | number;
};

export function makeTx(overrides: TxOverrides = {}): TxView {
  sequence += 1;
  const tx: TxView = {
    id: `tx-${sequence}`,
    cardId: "card-1",
    occurredOn: "2026-09-01" as IsoDate,
    merchantRaw: "가상 가맹점",
    merchantKey: `merchant-${sequence}`,
    amountKrw: toKRW(10_000),
    kind: "spend",
    status: "posted",
    category: "기타",
    categorySource: "rule",
    installmentMonths: null,
    foreignAmount: null,
    foreignCurrency: null,
  };
  return {
    ...tx,
    ...overrides,
    occurredOn: (overrides.occurredOn ?? tx.occurredOn) as IsoDate,
    amountKrw: toKRW(overrides.amountKrw ?? tx.amountKrw),
  };
}
