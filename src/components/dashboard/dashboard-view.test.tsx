import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { buildDashboardModel } from "@/lib/analytics/dashboard";
import type { IsoDate, YearMonth } from "@/lib/domain/types";
import type { Journey } from "@/lib/domain/journey";
import { makeTx } from "@/test/tx-factory";
import { DashboardView } from "./dashboard-view";

const data = buildDashboardModel({ txs: [makeTx({ merchantRaw: "서점", merchantKey: "서점", category: "교육", amountKrw: 18_000 })], month: "2026-09" as YearMonth, availableMonths: ["2026-09" as YearMonth], today: "2026-10-03" as IsoDate });
const journey: Journey = { checklist: [{ key: "signup", done: true }, { key: "first_upload", done: true }, { key: "three_months", done: false, progress: { now: 1, goal: 3 } }, { key: "first_insight", done: false }], primary: "three_months" };

it("대시보드 섹션과 거래 링크 및 선택적 Pro 슬롯을 표시한다", () => {
  render(<DashboardView data={data} basePath="/dashboard" proTeasers={<p>잠긴 기능</p>} />);
  expect(screen.getAllByText("₩18,000")).toHaveLength(3);
  expect(screen.getByRole("link", { name: "거래 전체 보기" })).toHaveAttribute("href", "/transactions?month=2026-09");
  expect(screen.getByRole("region", { name: "Pro 미리보기" })).toHaveTextContent("잠긴 기능");
});

it("한 줄 요약을 타일보다 먼저, 체크리스트를 TOP5 뒤와 Pro 영역 앞에 표시한다", () => {
  const { container } = render(<DashboardView data={data} basePath="/dashboard" journey={journey} proTeasers={<p>잠긴 기능</p>} />);
  const headline = screen.getByText(data.headline!);
  const spendLabel = screen.getByText("9월 지출");
  const merchantHeading = screen.getByRole("heading", { name: "TOP5 가맹점" });
  const checklistHeading = screen.getByRole("heading", { name: /시작하기/ });
  const proRegion = screen.getByRole("region", { name: "Pro 미리보기" });
  expect(headline.compareDocumentPosition(spendLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(merchantHeading.compareDocumentPosition(checklistHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(checklistHeading.compareDocumentPosition(proRegion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByText("카테고리가 틀리면 거래를 눌러 바꿀 수 있어요")).toBeInTheDocument();
  expect(container.querySelectorAll("a.bg-accent, button.bg-accent")).toHaveLength(1);
});

it("journey가 없으면 체크리스트를 표시하지 않는다", () => {
  render(<DashboardView data={data} basePath="/demo" showTransactionsLink={false} />);
  expect(screen.queryByRole("heading", { name: /시작하기/ })).not.toBeInTheDocument();
  expect(screen.queryByText("카테고리가 틀리면 거래를 눌러 바꿀 수 있어요")).not.toBeInTheDocument();
});

it("거래가 없는 달을 안내한다", () => {
  const empty = buildDashboardModel({ txs: [], month: "2026-09" as YearMonth, availableMonths: ["2026-09" as YearMonth], today: "2026-09-03" as IsoDate });
  render(<DashboardView data={empty} basePath="/dashboard" />);
  expect(screen.getByText("이 달에는 거래가 없어요")).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Pro 미리보기" })).not.toBeInTheDocument();
});

it("요청하면 거래 링크를 숨긴다", () => {
  render(<DashboardView data={data} basePath="/demo" showTransactionsLink={false} />);
  expect(screen.queryByRole("link", { name: "거래 전체 보기" })).not.toBeInTheDocument();
});
