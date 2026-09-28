import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { FAQ } from "./faq";

it("answers the common questions in the designed order without client-side interaction", () => {
  const { container } = render(<FAQ />);
  expect(Array.from(container.querySelectorAll("summary"), (summary) => summary.textContent)).toEqual([
    "어떤 카드사를 지원하나요?",
    "AI가 분류를 틀리면요?",
    "파일은 어디서 받나요?",
    "어떤 카드로 결제할 수 있나요?",
    "데이터를 직접 삭제할 수 있나요?",
    "투자 조언도 해 주나요?",
  ]);
  expect(screen.getByText(/신한·삼성·현대·KB국민·롯데·하나/)).toBeInTheDocument();
  expect(screen.getByText(/같은 가맹점 모두/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "가이드" })).toHaveAttribute("href", "/guide");
  expect(screen.getByText(/VISA·Mastercard/)).toBeInTheDocument();
  expect(screen.getByText(/업로드별 삭제·전체 삭제·탈퇴/)).toBeInTheDocument();
  expect(screen.getByText(/재무·투자·세무 조언을 하지 않아요/)).toBeInTheDocument();
  for (const summary of container.querySelectorAll("summary")) expect(summary).toHaveClass("focus-visible:outline-2");
});
