import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { IsoDate } from "@/lib/domain/types";
import { UploadResult } from "./upload-result";
const iso = (v: string) => v as IsoDate;

it("기간과 0이 아닌 건수만 요약하고 다시 분류한다", async () => {
  const user = userEvent.setup(); const retry = vi.fn();
  render(<UploadResult result={{ inserted: 132, duplicates: 0, pending: 5, period: { from: iso("2026-07-01"), to: iso("2026-09-30") } }} onRecategorize={retry} />);
  expect(screen.getByText("7~9월 · 132건 추가 · 분류 실패 5건")).toBeInTheDocument();
  expect(screen.queryByText(/이미 있던/)).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "다시 분류" })); expect(retry).toHaveBeenCalled();
});

it("연도 경계와 추가 0건을 표시한다", () => {
  render(<UploadResult result={{ inserted: 0, duplicates: 2, pending: 0, period: { from: iso("2025-12-01"), to: iso("2026-01-31") } }} />);
  expect(screen.getByText("2025년 12월~2026년 1월 · 새로 추가된 거래가 없어요 · 이미 있던 2건")).toBeInTheDocument();
});
