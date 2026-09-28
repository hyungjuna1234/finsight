import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getLandingShowcase, type LandingShowcase } from "@/lib/demo/landing";
import { formatKRW } from "@/lib/domain/money";
import { SpendTiles } from "./spend-tiles";

function renderTiles(showcase: LandingShowcase = getLandingShowcase()) {
  return render(<SpendTiles showcase={showcase} />);
}

describe("SpendTiles", () => {
  it("renders the section copy and four calculated tiles", () => {
    renderTiles();

    const section = screen.getByRole("region", { name: "새는 돈이 숫자로 보여요" });
    expect(within(section).getByText("한 달 내역에서 찾아내는 것")).toBeInTheDocument();
    expect(within(section).getByText("아래는 예시예요. 내 파일을 올리면 내 숫자로 바뀌어요.")).toBeInTheDocument();
    expect(within(section).getAllByRole("article")).toHaveLength(4);
    expect(section).not.toHaveTextContent("AI");
  });

  it("omits the comparison tile when there is no increase", () => {
    const showcase = { ...getLandingShowcase(), increase: null };
    renderTiles(showcase);

    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.queryByText("지난달보다 늘어난 지출")).not.toBeInTheDocument();
  });

  it("shows every recurring item, its total, and the Pro scope", () => {
    const showcase = getLandingShowcase();
    renderTiles(showcase);
    const tile = screen.getByRole("article", { name: "잊고 있던 정기결제" });

    expect(tile).toHaveTextContent(formatKRW(showcase.recurring.monthlyTotal));
    for (const item of showcase.recurring.items) expect(within(tile).getByText(item.label)).toBeInTheDocument();
    expect(within(tile).getByText("목록은 Pro")).toBeInTheDocument();
  });

  it("shows the increase rate and Pro tag", () => {
    const increase = getLandingShowcase().increase;
    expect(increase).not.toBeNull();
    renderTiles();
    const tile = screen.getByRole("article", { name: "지난달보다 늘어난 지출" });

    expect(tile).toHaveTextContent(`+${increase!.rate}%`);
    expect(within(tile).getByText("Pro")).toBeInTheDocument();
  });

  it("marks only Saturday and Sunday as weekend bars and provides text alternatives", () => {
    const showcase = getLandingShowcase();
    renderTiles(showcase);
    const tile = screen.getByRole("article", { name: "주말 지출 비율" });
    const bars = within(tile).getAllByTestId("weekday-bar");

    expect(bars).toHaveLength(7);
    bars.forEach((bar, index) => {
      if (index >= 5) expect(bar).toHaveClass("bg-accent");
      else expect(bar).toHaveClass("bg-chart-muted");
    });
    for (const day of showcase.weekend.days) {
      expect(within(tile).getByText(`${day.label} ${formatKRW(day.amount)}`, { selector: "li" })).toBeInTheDocument();
    }
  });

  it("renders one visible legend item for each category bar", () => {
    const showcase = getLandingShowcase();
    renderTiles(showcase);
    const tile = screen.getByRole("article", { name: "가장 많이 쓴 카테고리" });

    expect(within(tile).getAllByTestId("category-legend-item")).toHaveLength(showcase.categoryBars.length);
  });
});
