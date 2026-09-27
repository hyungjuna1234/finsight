import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DEMO_INSIGHT, getDemoProPreview } from "@/lib/demo/fixtures";
import { DemoProPreview } from "./demo-pro-preview";

it("renders recurring, trend, signed comparison, and plain insight previews", () => {
  render(<DemoProPreview {...getDemoProPreview()} insight={DEMO_INSIGHT} />);
  expect(screen.getByRole("heading", { name: "Pro 기능 미리보기" })).toBeInTheDocument();
  expect(screen.getByText("웨이브")).toBeInTheDocument();
  expect(screen.getAllByText(/다음 예상일/).length).toBeGreaterThan(0);
  expect(screen.getByRole("list", { name: "월별 추이 데이터" })).toHaveTextContent("7월");
  const delta = screen.getByTestId("month-delta");
  expect(delta).toHaveTextContent(/[+−]₩/);
  expect(delta).toHaveClass(getDemoProPreview().delta.netDiff >= 0 ? "text-spend-up" : "text-spend-down");
  expect(screen.getByText(DEMO_INSIGHT.headline)).toBeInTheDocument();
  expect(screen.getByText("지출 정리를 돕는 요약이에요. 투자·세무 조언이 아니에요.")).toBeInTheDocument();
});
