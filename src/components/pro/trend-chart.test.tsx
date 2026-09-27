import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TrendChart } from "./trend-chart";
import type { YearMonth } from "@/lib/domain/types";
it("차트와 테스트 가능한 월별 목록을 표시한다", () => { render(<TrendChart points={[{ month: "2026-08" as YearMonth, net: 10000 }, { month: "2026-09" as YearMonth, net: 20000 }]} />); expect(screen.getByRole("list", { name: "월별 추이 데이터" })).toHaveTextContent("8월₩10,000"); });
