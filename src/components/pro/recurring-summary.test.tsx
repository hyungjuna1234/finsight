import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { toKRW } from "@/lib/domain/money";
import { RecurringSummary } from "./recurring-summary";
it("정기결제 건수와 월 합계를 표시한다", () => { render(<RecurringSummary count={5} monthlyTotal={toKRW(47600)} href="/recurring" />); expect(screen.getByRole("link")).toHaveTextContent("정기결제 5건 · 월 ₩47,600"); });
