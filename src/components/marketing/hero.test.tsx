import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { getLandingShowcase } from "@/lib/demo/landing";
import { Hero } from "./hero";

it("presents the product with left-aligned calls to action", () => {
  const { container } = render(<Hero showcase={getLandingShowcase()} />);
  const heading = screen.getByRole("heading", { level: 1, name: "월급이 어디로 새는지, 파일 하나로 AI가 찾아 드려요" });
  expect(heading.querySelector("mark")).toHaveTextContent("어디로 새는지");
  expect(screen.getByRole("link", { name: "무료로 시작" })).toHaveAttribute("href", "/login?next=%2Fupload");
  expect(screen.getByRole("link", { name: "로그인 없이 예시 보기" })).toHaveAttribute("href", "/demo");
  expect(container.firstElementChild).not.toHaveClass("text-center");
});

it("shows all three trust statements", () => {
  render(<Hero showcase={getLandingShowcase()} />);
  expect(screen.getByText("계좌·카드 연동 없음")).toBeInTheDocument();
  expect(screen.getByText("원본은 90일 뒤 자동 삭제")).toBeInTheDocument();
  expect(screen.getByText("첫 AI 리포트 무료")).toBeInTheDocument();
});
