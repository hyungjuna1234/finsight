import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { YearMonth } from "@/lib/domain/types";
import { MonthPicker } from "./month-picker";
const ym = (v: string) => v as YearMonth;

it("이웃 달과 전체 달을 링크로 제공한다", () => {
  render(<MonthPicker month={ym("2026-09")} availableMonths={[ym("2026-10"), ym("2026-09"), ym("2026-08")]} basePath="/dashboard" />);
  expect(screen.getByRole("link", { name: "‹ 이전 달" })).toHaveAttribute("href", "/dashboard?month=2026-08");
  expect(screen.getAllByText("2026년 9월")).toHaveLength(2);
  expect(screen.getByRole("link", { name: "다음 달 ›" })).toHaveAttribute("href", "/dashboard?month=2026-10");
  expect(screen.getByRole("link", { name: "2026년 8월" })).toHaveAttribute("href", "/dashboard?month=2026-08");
});

it("목록에 없는 이웃 달은 비활성 텍스트다", () => {
  render(<MonthPicker month={ym("2026-09")} availableMonths={[ym("2026-09")]} basePath="/demo" />);
  expect(screen.queryByRole("link", { name: "‹ 이전 달" })).not.toBeInTheDocument();
  expect(screen.getByText("‹ 이전 달")).toHaveAttribute("aria-disabled", "true");
});
