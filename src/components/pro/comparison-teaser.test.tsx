import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ComparisonTeaser } from "./comparison-teaser";
import type { YearMonth } from "@/lib/domain/types";
it("전월 이름만 표시하고 수치를 표시하지 않는다", () => { render(<ComparisonTeaser previousMonth={"2026-08" as YearMonth} />); expect(screen.getByText("8월과 비교한 결과가 준비됐어요")).toBeInTheDocument(); expect(document.body.textContent).not.toMatch(/₩|%/); });
