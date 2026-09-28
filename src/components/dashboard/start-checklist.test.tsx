import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Journey } from "@/lib/domain/journey";
import type { YearMonth } from "@/lib/domain/types";
import { StartChecklist } from "./start-checklist";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track }));

const journey: Journey = {
  checklist: [
    { key: "signup", done: true },
    { key: "first_upload", done: true },
    { key: "three_months", done: false, progress: { now: 2, goal: 3 } },
    { key: "first_insight", done: false },
  ],
  primary: "three_months",
};

describe("StartChecklist", () => {
  beforeEach(() => track.mockClear());

  it("checklist가 null이면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(<StartChecklist journey={{ checklist: null, primary: "pro_upgrade" }} month={"2026-09" as YearMonth} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("완료 수와 진행률을 표시하고 primary 행동만 accent로 강조한다", () => {
    const { container } = render(<StartChecklist journey={journey} month={"2026-09" as YearMonth} />);
    expect(screen.getByRole("heading", { name: "시작하기 · 4단계 중 2단계 완료" })).toBeInTheDocument();
    expect(screen.getByText("석 달 치 채우기 · 2/3달")).toBeInTheDocument();
    expect(screen.getByText("정기결제와 전월 비교를 찾아 드려요")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "지난 내역 올리기" })).toHaveClass("bg-accent");
    expect(screen.getByRole("link", { name: "리포트 만들기" })).not.toHaveClass("bg-accent");
    expect(container.querySelectorAll("a.bg-accent")).toHaveLength(1);
  });

  it("미완료 행동을 next_step_click으로 추적한다", async () => {
    render(<StartChecklist journey={journey} month={"2026-09" as YearMonth} />);
    await userEvent.click(screen.getByRole("link", { name: "지난 내역 올리기" }));
    expect(track).toHaveBeenCalledWith("next_step_click", { step: "three_months" });
    await userEvent.click(screen.getByRole("link", { name: "리포트 만들기" }));
    expect(track).toHaveBeenCalledWith("next_step_click", { step: "first_insight" });
  });
});
