import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { toKRW } from "@/lib/domain/money";
import { ProTeasers } from "./pro-teasers";
import type { YearMonth } from "@/lib/domain/types";
it("Free 패널은 요약과 잠금 티저, 무료 리포트와 질문을 표시한다", () => { render(<ProTeasers panel={{ kind: "free", month: "2026-09" as YearMonth, recurring: { count: 2, monthlyTotal: toKRW(20000) }, comparisonLocked: { previousMonth: "2026-08" as YearMonth }, trendLocked: true, freeInsight: true, chatExamples: ["질문 예시"] }} />); expect(screen.getByText("정기결제 2건 · 월 ₩20,000")).toBeInTheDocument(); expect(screen.getByRole("link", { name: "리포트 만들기" })).toHaveAttribute("href", "/insights?month=2026-09"); expect(screen.getByRole("link", { name: "질문 예시" })).toHaveAttribute("href", "/chat"); });
it("Pro 패널은 상세 페이지 링크를 표시한다", () => { render(<ProTeasers panel={{ kind: "pro", month: "2026-09" as YearMonth, delta: null, recurring: { count: 0, monthlyTotal: toKRW(0) } }} />); expect(screen.getByRole("link", { name: /정기결제/ })).toHaveAttribute("href", "/recurring"); expect(screen.getByRole("link", { name: "추이 보기" })).toHaveAttribute("href", "/trends"); });
