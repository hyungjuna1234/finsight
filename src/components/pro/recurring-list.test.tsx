import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { toKRW } from "@/lib/domain/money";
import { RecurringList } from "./recurring-list";
import type { IsoDate } from "@/lib/domain/types";
it("정기결제 상세를 표시한다", () => { render(<RecurringList items={[{ merchantKey: "m", label: "웨이브", avgAmount: toKRW(10900), monthlyEstimate: toKRW(10900), occurrences: 3, lastDate: "2026-09-04" as IsoDate, nextExpectedDate: "2026-10-04" as IsoDate }]} />); expect(screen.getByText("웨이브")).toBeInTheDocument(); expect(screen.getByText("월 ₩10,900")).toBeInTheDocument(); expect(screen.getByText(/최근 결제일 2026-09-04/)).toBeInTheDocument(); expect(screen.getByText(/다음 예상일 2026-10-04/)).toBeInTheDocument(); });
