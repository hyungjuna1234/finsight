import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getLandingShowcase, type LandingShowcase } from "@/lib/demo/landing";
import { formatKRW } from "@/lib/domain/money";
import { formatMonthLabel } from "@/lib/domain/month";
import { ReportShowcase } from "./report-showcase";

function renderShowcase(showcase: LandingShowcase = getLandingShowcase()) {
  return render(<ReportShowcase showcase={showcase} />);
}

describe("ReportShowcase", () => {
  it("renders the report heading, verified content, and calculated metrics", () => {
    const showcase = getLandingShowcase();
    renderShowcase(showcase);
    const section = screen.getByRole("region", { name: "숫자는 정확하게 계산하고, 설명은 AI가 쉽게 풀어 줘요" });

    expect(within(section).getByText("AI 리포트", { selector: "p" })).toBeInTheDocument();
    expect(within(section).getByRole("heading", { name: `${formatMonthLabel(showcase.month, "short")} AI 리포트` })).toBeInTheDocument();
    expect(within(section).getByText("예시")).toBeInTheDocument();
    expect(section).toHaveTextContent(formatKRW(showcase.total));
    expect(section).toHaveTextContent(`${showcase.report.weekendShare}%`);
    expect(section).toHaveTextContent(showcase.report.content.headline);
    for (const point of showcase.report.content.points) expect(section).toHaveTextContent(point);
    for (const tip of showcase.report.content.tips) expect(section).toHaveTextContent(tip);
  });

  it("omits the previous-month metric when netRate is null", () => {
    const showcase = getLandingShowcase();
    renderShowcase({ ...showcase, report: { ...showcase.report, netRate: null } });

    expect(screen.queryByText("지난달보다")).not.toBeInTheDocument();
  });

  it("shows the disclaimer and the three explanations in order", () => {
    renderShowcase();
    expect(screen.getByText("지출 정리를 돕는 요약이에요. 투자·세무 조언이 아니에요.")).toBeInTheDocument();

    const explanations = screen.getByRole("list", { name: "AI 리포트가 만들어지는 과정" });
    expect(within(explanations).getAllByRole("listitem").map((item) => item.querySelector("strong")?.textContent)).toEqual([
      "숫자는 FinSight가 직접 계산해요",
      "문장은 AI가 써요",
      "다음 달에 해 볼 일까지",
    ]);
  });

  it("renders the Pro chat example with its calculated amount", () => {
    const showcase = getLandingShowcase();
    expect(showcase.chat).not.toBeNull();
    renderShowcase(showcase);
    const chat = screen.getByRole("article", { name: "채팅 예시" });

    expect(within(chat).getByText("Pro")).toBeInTheDocument();
    expect(chat).toHaveTextContent(formatKRW(showcase.chat!.amount));
  });

  it("omits the chat card when chat data is unavailable", () => {
    renderShowcase({ ...getLandingShowcase(), chat: null });
    expect(screen.queryByRole("article", { name: "채팅 예시" })).not.toBeInTheDocument();
  });

  it("does not render fake buttons", () => {
    const { container } = renderShowcase();
    expect(container.querySelector("button")).toBeNull();
  });
});
