import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { HowItWorks } from "./how-it-works";

it("shows the three ordered steps and highlights the important choices", () => {
  const { container } = render(<HowItWorks />);

  expect(screen.getByRole("heading", { level: 2, name: "3단계면 첫 대시보드를 볼 수 있어요" })).toBeInTheDocument();
  const steps = within(screen.getByRole("list")).getAllByRole("listitem");
  expect(steps.map((step) => within(step).getByRole("heading", { level: 3 }).textContent)).toEqual([
    "카드사 홈페이지에서",
    "최근 3개월을 엑셀로 저장",
    "FinSight에 올리기",
  ]);

  expect(screen.getByText("이용내역", { selector: "mark" })).toHaveClass("bg-mark");
  expect(screen.getByText("최근 3개월", { selector: "mark" })).toHaveClass("bg-mark");
  expect(container.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(3);
  expect(container.querySelectorAll("svg[stroke-width='1.5']")).toHaveLength(3);
});

it("lists supported issuers, guide link, and the mobile handoff tip", () => {
  render(<HowItWorks />);

  for (const issuer of ["신한", "삼성", "현대", "KB국민", "롯데", "하나"]) {
    expect(screen.getByText(issuer)).toBeInTheDocument();
  }
  expect(screen.getByRole("link", { name: "카드사별 받는 법 →" })).toHaveAttribute("href", "/guide");
  expect(screen.getByText("휴대폰만 있다면 PC에서 열 링크를 복사해 카카오톡 '나와의 채팅'에 붙여 두세요.")).toBeInTheDocument();
});
