import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SubscriptionPanel } from "./subscription-panel";

it("shows Free and Pro subscription summaries", () => {
  const { rerender } = render(<SubscriptionPanel plan="free" status="none" periodEnd={null} active={false} cancelAtPeriodEnd={false} />);
  expect(screen.getByText("Free 플랜을 쓰고 있어요")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Pro 시작하기" })).toHaveAttribute("href", "/pricing");
  rerender(<SubscriptionPanel plan="pro" status="past_due" periodEnd="2026-10-25T15:30:00.000Z" active cancelAtPeriodEnd={false} />);
  expect(screen.getByText("Pro · 현재 결제 기간 2026년 10월 26일까지")).toBeInTheDocument();
  expect(screen.getByText(/7일 안에 결제 수단을 바꿔 주세요/)).toHaveClass("text-warning");
  expect(screen.queryByText(/해지를 예약했어요/)).not.toBeInTheDocument();
});

it("shows when a scheduled cancellation ends Pro", () => {
  render(<SubscriptionPanel plan="pro" status="active" periodEnd="2026-10-30T11:49:26.535Z" active cancelAtPeriodEnd />);
  expect(screen.getByText("Pro · 2026년 10월 30일까지 쓸 수 있어요")).toBeInTheDocument();
  expect(screen.getByText("해지를 예약했어요. 이 날짜가 지나면 Free로 바뀌어요.")).toBeInTheDocument();
  expect(screen.queryByText(/현재 결제 기간/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "구독 관리" })).toBeInTheDocument();
});
