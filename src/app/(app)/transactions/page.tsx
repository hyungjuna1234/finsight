import { redirect } from "next/navigation";
import { groupByDate } from "@/lib/analytics/list";
import { safeRedirect } from "@/lib/domain/redirect";
import { parseTxFilters, toTxFilterQuery } from "@/lib/domain/tx-filters";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { TxFiltersForm } from "@/components/dashboard/tx-filters";
import { listTransactions } from "@/server/queries/transactions";

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseTxFilters(await searchParams); const data = await listTransactions(filters); if (data.state === "empty") redirect(safeRedirect("/upload"));
  const nextCursorHref = data.nextCursor === null ? null : `/transactions${toTxFilterQuery({ ...data.filters, cursor: data.nextCursor })}`;
  return <main className="space-y-8"><h1 className="text-2xl font-semibold text-ink">거래 내역</h1><TxFiltersForm month={data.month} availableMonths={data.availableMonths} filters={data.filters} cards={data.cards} /><TransactionList groups={groupByDate(data.items)} month={data.month} nextCursorHref={nextCursorHref} /></main>;
}
