import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toKRW } from "@/lib/domain/money";
import { ProTeasers } from "./pro-teasers";
import type { YearMonth } from "@/lib/domain/types";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track }));

const freePanel = { kind: "free" as const, month: "2026-09" as YearMonth, recurring: { count: 2, monthlyTotal: toKRW(20000) }, comparisonLocked: { previousMonth: "2026-08" as YearMonth }, trendLocked: true, freeInsight: true, chatExamples: ["질문 예시"] };

describe("ProTeasers", () => {
  beforeEach(() => track.mockClear());

  it("Free 패널은 기본적으로 accent 채움 행동과 리포트 만들기를 표시하지 않는다", () => {
    const { container } = render(<ProTeasers panel={freePanel} />);
    expect(screen.getByText("정기결제 2건 · 월 ₩20,000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "질문 예시" })).toHaveAttribute("href", "/chat");
    expect(screen.queryByRole("link", { name: "리포트 만들기" })).not.toBeInTheDocument();
    expect(container.querySelectorAll("a.bg-accent, button.bg-accent")).toHaveLength(0);
  });

  it("primary이면 Free 영역 맨 위에 Primary 행동을 정확히 하나 표시하고 추적한다", async () => {
    const { container } = render(<ProTeasers panel={freePanel} primary />);
    expect(screen.getByText("추이·전월 비교·정기결제 목록·AI 리포트를 매달 받아요")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Pro 시작하기" });
    expect(link).toHaveAttribute("href", "/pricing");
    expect(container.querySelectorAll("a.bg-accent, button.bg-accent")).toHaveLength(1);
    await userEvent.click(link);
    expect(track).toHaveBeenCalledWith("next_step_click", { step: "pro_upgrade" });
  });

  it("Pro 패널은 상세 페이지 링크를 표시한다", () => {
    render(<ProTeasers panel={{ kind: "pro", month: "2026-09" as YearMonth, delta: null, recurring: { count: 0, monthlyTotal: toKRW(0) } }} />);
    expect(screen.getByRole("link", { name: /정기결제/ })).toHaveAttribute("href", "/recurring");
    expect(screen.getByRole("link", { name: "추이 보기" })).toHaveAttribute("href", "/trends");
  });
});
