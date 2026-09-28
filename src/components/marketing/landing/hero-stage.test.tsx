import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { getLandingShowcase, type LandingShowcase } from "@/lib/demo/landing";
import { HeroStage } from "./hero-stage";

function renderStage(increase: LandingShowcase["increase"] = getLandingShowcase().increase) {
  const showcase = getLandingShowcase();
  return render(<HeroStage
    month={showcase.month}
    total={showcase.total}
    count={showcase.count}
    rows={showcase.sheetRows}
    bars={showcase.categoryBars}
    insight={{ headline: showcase.report.content.headline, increase }}
  />);
}

it("renders the sheet rows, category bars, example label, and caption", () => {
  const showcase = getLandingShowcase();
  renderStage();

  const figure = screen.getByRole("figure", { name: "이용내역 파일이 AI 리포트로 바뀌는 과정 예시" });
  expect(within(figure).getAllByTestId("sheet-data-row")).toHaveLength(showcase.sheetRows.length);
  for (const row of showcase.sheetRows) expect(within(figure).getByText(row.merchant)).toBeInTheDocument();
  expect(within(figure).getAllByTestId("category-bar")).toHaveLength(showcase.categoryBars.length);
  expect(within(figure).getByText("예시")).toBeInTheDocument();
  expect(within(figure).getByText("예시 데이터로 만든 화면이에요")).toBeInTheDocument();
});

it("shows the increase only when one exists", () => {
  const increase = getLandingShowcase().increase;
  expect(increase).not.toBeNull();
  const first = renderStage(increase);
  expect(within(first.container).getByText(`▲ ${increase!.rate}%`)).toBeInTheDocument();
  first.unmount();

  const second = renderStage(null);
  expect(within(second.container).queryByText(/^▲ /)).not.toBeInTheDocument();
});

it("guards every animation with the motion-safe variant", () => {
  const { container } = renderStage();
  const animationClasses = container.innerHTML.match(/[^\s"']*animate-[^\s"']*/g) ?? [];
  expect(animationClasses.length).toBeGreaterThan(0);
  for (const className of animationClasses) expect(className).toMatch(/^motion-safe:animate-landing-/);
});
