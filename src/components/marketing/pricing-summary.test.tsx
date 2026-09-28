import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { formatKRW } from "@/lib/domain/money";
import { PRO_MONTHLY_KRW } from "@/lib/domain/pricing";
import { PricingSummary } from "./pricing-summary";

it("shows the canonical Free and Pro pricing and features", () => {
  render(<PricingSummary />);
  expect(screen.getByText("₩0")).toBeInTheDocument();
  expect(screen.getByText(formatKRW(PRO_MONTHLY_KRW))).toBeInTheDocument();
  expect(screen.getByText("첫 AI 리포트 1회 무료").closest("li")).toHaveClass("bg-accent-soft", "font-semibold", "text-ink", "rounded-md");
  expect(screen.getByRole("link", { name: "요금 자세히" })).toHaveAttribute("href", "/pricing");
  expect(screen.getByText("해외결제가 되는 카드(VISA·Mastercard)가 필요해요. 언제든 해지할 수 있어요.")).toBeInTheDocument();
});
