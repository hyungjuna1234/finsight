import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { summarizeMonth } from "@/lib/analytics/month";
import type { YearMonth } from "@/lib/domain/types";
import { makeTx } from "@/test/tx-factory";
import { CategoryChart } from "./category-chart";

it("차트와 동일한 카테고리 금액·비율 목록을 표시한다", () => {
  const summary = summarizeMonth([makeTx({ category: "식비", amountKrw: 30_000 }), makeTx({ category: "교통", amountKrw: 10_000 })], "2026-09" as YearMonth);
  render(<CategoryChart items={summary.byCategory} />);
  expect(screen.getByText("식비")).toBeInTheDocument();
  expect(screen.getByText("₩30,000")).toBeInTheDocument();
  expect(screen.getByText("75%")).toBeInTheDocument();
});
