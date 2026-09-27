import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SiteFooter } from "./site-footer";
import { BUSINESS_INFO } from "@/lib/domain/legal";

it("shows policy links and the service disclaimer", () => {
  render(<SiteFooter />);
  expect(screen.getByRole("link", { name: "개인정보 처리방침" })).toHaveAttribute("href", "/privacy");
  expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute("href", "/terms");
  expect(screen.getByRole("link", { name: "환불 정책" })).toHaveAttribute("href", "/refund");
  expect(screen.getByRole("link", { name: "가이드" })).toHaveAttribute("href", "/guide");
  expect(screen.getByText("지출 정리를 돕는 서비스예요. 재무·투자·세무 조언을 하지 않아요.")).toBeInTheDocument();
  expect(screen.getByText(BUSINESS_INFO.registrationNo, { exact: false })).toBeInTheDocument();
  expect(screen.getByText(BUSINESS_INFO.mailOrderNo, { exact: false })).toBeInTheDocument();
});
