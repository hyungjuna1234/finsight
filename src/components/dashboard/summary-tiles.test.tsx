import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { summarizeMonth } from "@/lib/analytics/month";
import type { YearMonth } from "@/lib/domain/types";
import { makeTx } from "@/test/tx-factory";
import { SummaryTiles } from "./summary-tiles";

it("지출·환불·거래 건수와 추정 건수를 포맷해 표시한다", () => {
  const summary = summarizeMonth([makeTx({ amountKrw: 100_000, status: "pending" }), makeTx({ amountKrw: 20_000, kind: "refund" })], "2026-09" as YearMonth);
  render(<SummaryTiles summary={summary} />);
  expect(screen.getByText("₩80,000")).toBeInTheDocument();
  expect(screen.getByText("₩20,000")).toBeInTheDocument();
  expect(screen.getByText("2건")).toBeInTheDocument();
  expect(screen.getByText("추정 금액 1건 포함")).toBeInTheDocument();
  expect(screen.getByText("9월 지출")).toBeInTheDocument();
  expect(screen.getByText("₩80,000")).toHaveClass("text-3xl");
  expect(screen.getByText("₩20,000")).toHaveClass("text-xl");
  expect(screen.getByText("2건")).toHaveClass("text-xl");
});
