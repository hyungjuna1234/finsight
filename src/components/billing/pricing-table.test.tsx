import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingTable } from "./pricing-table";

describe("PricingTable", () => {
  it("shows the shared comparison, price, notices, and anonymous CTA", () => {
    render(<PricingTable viewer="anonymous" checkoutFailed />);
    expect(screen.getByText("₩6,900/월")).toBeInTheDocument();
    expect(screen.getByText(/기본 통화 \$4\.99/)).toBeInTheDocument();
    expect(screen.getByText(/국내전용 카드는 결제되지 않아요/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하고 Pro 시작하기" })).toHaveAttribute("href", "/login?next=%2Fpricing");
    expect(screen.getByRole("alert")).toHaveTextContent("결제가 완료되지 않았어요");
    expect(screen.getByRole("link", { name: "환불 정책" })).toHaveAttribute("href", "/refund");
    expect(screen.getByRole("columnheader", { name: "Free" })).toBeInTheDocument();
  });

  it("shows plan-specific actions", () => {
    const { rerender } = render(<PricingTable viewer="free" checkoutFailed={false} />);
    expect(screen.getByRole("button", { name: "Pro 시작하기" })).toBeInTheDocument();
    rerender(<PricingTable viewer="pro" checkoutFailed={false} />);
    expect(screen.getByText("이미 Pro를 쓰고 있어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "구독 관리" })).toBeInTheDocument();
  });
});
