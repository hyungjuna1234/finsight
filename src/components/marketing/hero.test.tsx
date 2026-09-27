import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Hero } from "./hero";

it("presents the product with left-aligned calls to action", () => {
  const { container } = render(<Hero />);
  expect(screen.getByRole("heading", { level: 1, name: "카드 이용내역 파일만 올리면, 한 달 지출이 정리돼요" })).toHaveClass("text-4xl");
  expect(screen.getByText("연동 없이 카드사 홈페이지에서 받은 파일만 올려요.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "무료로 시작" })).toHaveAttribute("href", "/login?next=%2Fupload");
  expect(screen.getByRole("link", { name: "예시 보기" })).toHaveAttribute("href", "/demo");
  expect(container.firstElementChild).not.toHaveClass("text-center");
});
