import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { toKRW } from "@/lib/domain/money";
import { MonthComparison } from "./month-comparison";
import type { YearMonth } from "@/lib/domain/types";
it("증가 금액·비율·상위 카테고리를 기호와 색으로 표시한다", () => { render(<MonthComparison delta={{ month: "2026-09" as YearMonth, previousMonth: "2026-08" as YearMonth, netDiff: 12000, netRate: .12, topIncreases: [{ category: "식비", current: toKRW(20000), previous: toKRW(10000), diff: 10000 }] }} />); const value = screen.getByTestId("month-delta"); expect(value).toHaveTextContent("+₩12,000 · +12%"); expect(value).toHaveClass("text-spend-up"); expect(screen.getByText("식비").parentElement).toHaveTextContent("+₩10,000"); });
