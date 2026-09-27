import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SubscriptionPanel } from "./subscription-panel";

it("shows Free and Pro subscription summaries", () => {
  const { rerender } = render(<SubscriptionPanel plan="free" status="none" periodEnd={null} active={false} />);
  expect(screen.getByText("Free 플랜을 쓰고 있어요")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Pro 시작하기" })).toHaveAttribute("href", "/pricing");
  rerender(<SubscriptionPanel plan="pro" status="past_due" periodEnd="2026-10-25T15:30:00.000Z" active />);
  expect(screen.getByText("Pro · 현재 결제 기간 2026년 10월 26일까지")).toBeInTheDocument();
  expect(screen.getByText(/7일 안에 결제 수단을 바꿔 주세요/)).toHaveClass("text-warning");
});
