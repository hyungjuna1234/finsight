import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { formatKRW } from "@/lib/domain/money";
import { PRO_MONTHLY_KRW } from "@/lib/domain/pricing";
import { PricingSummary } from "./pricing-summary";

it("shows the canonical Free and Pro pricing", () => {
  render(<PricingSummary />);
  expect(screen.getByText("₩0 · 업로드·분류·월별 대시보드")).toBeInTheDocument();
  expect(screen.getByText(`${formatKRW(PRO_MONTHLY_KRW)}/월`)).toBeInTheDocument();
  expect(screen.getByText("AI 리포트·Q&A 채팅·추이·정기결제")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "요금 자세히" })).toHaveAttribute("href", "/pricing");
  expect(screen.getByText(/해외결제.*카드/)).toBeInTheDocument();
});
