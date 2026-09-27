import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { buildDashboardModel } from "@/lib/analytics/dashboard";
import type { IsoDate, YearMonth } from "@/lib/domain/types";
import { makeTx } from "@/test/tx-factory";
import { DashboardView } from "./dashboard-view";

const data = buildDashboardModel({ txs: [makeTx({ merchantRaw: "서점", merchantKey: "서점", category: "교육", amountKrw: 18_000 })], month: "2026-09" as YearMonth, availableMonths: ["2026-09" as YearMonth], today: "2026-10-03" as IsoDate });

it("대시보드 섹션과 거래 링크 및 선택적 Pro 슬롯을 표시한다", () => {
  render(<DashboardView data={data} basePath="/dashboard" proTeasers={<p>잠긴 기능</p>} />);
  expect(screen.getAllByText("₩18,000")).toHaveLength(3);
  expect(screen.getByRole("link", { name: "거래 전체 보기" })).toHaveAttribute("href", "/transactions?month=2026-09");
  expect(screen.getByRole("region", { name: "Pro 미리보기" })).toHaveTextContent("잠긴 기능");
});

it("거래가 없는 달을 안내한다", () => {
  const empty = buildDashboardModel({ txs: [], month: "2026-09" as YearMonth, availableMonths: ["2026-09" as YearMonth], today: "2026-09-03" as IsoDate });
  render(<DashboardView data={empty} basePath="/dashboard" />);
  expect(screen.getByText("이 달에는 거래가 없어요")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Pro 미리보기" })).not.toBeInTheDocument();
});
