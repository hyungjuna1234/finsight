import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { FAQ } from "./faq";

it("answers five common questions without client-side interaction", () => {
  const { container } = render(<FAQ />);
  expect(container.querySelectorAll("details")).toHaveLength(5);
  expect(container.querySelectorAll("summary")).toHaveLength(5);
  expect(screen.getByText(/신한·삼성·현대·KB국민·롯데·하나/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "가이드" })).toHaveAttribute("href", "/guide");
  expect(screen.getByText(/VISA·Mastercard/)).toBeInTheDocument();
  expect(screen.getByText(/업로드별 삭제·전체 삭제·탈퇴/)).toBeInTheDocument();
  expect(screen.getByText(/재무·투자·세무 조언을 하지 않아요/)).toBeInTheDocument();
});
