import type { Category } from "./categories";

export type TxKind = "spend" | "refund";
export type TxStatus = "posted" | "pending" | "cancelled";
export type CategorySource = "user" | "history" | "rule" | "ai" | "pending";
export type KRW = number & { readonly __brand: "KRW" };
export type YearMonth = string & { readonly __brand: "YearMonth" };
export type IsoDate = string & { readonly __brand: "IsoDate" };
export type Plan = "free" | "pro";

export interface TxView {
  id: string;
  cardId: string | null;
  occurredOn: IsoDate;
  merchantRaw: string;
  merchantKey: string;
  amountKrw: KRW;
  kind: TxKind;
  status: TxStatus;
  category: Category;
  categorySource: CategorySource;
  installmentMonths: number | null;
  foreignAmount: number | null;
  foreignCurrency: string | null;
}
