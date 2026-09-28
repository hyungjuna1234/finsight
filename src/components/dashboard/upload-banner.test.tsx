import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import type { YearMonth } from "@/lib/domain/types";
import { UploadBanner } from "./upload-banner";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock("@vercel/analytics", () => ({ track }));

beforeEach(() => track.mockClear());

it("올릴 월과 자동 확인 안내를 표시하고 행동을 추적한다", async () => {
  render(<UploadBanner month={"2026-09" as YearMonth} />);
  expect(screen.getByText("9월 내역을 올릴 차례예요. 같은 카드사 형식이면 확인 없이 바로 올라가요.")).toHaveClass("text-body");
  const link = screen.getByRole("link", { name: "9월 내역 올리기" });
  expect(link).toHaveAttribute("href", "/upload");
  await userEvent.click(link);
  expect(track).toHaveBeenCalledWith("next_step_click", { step: "stale_upload" });
});
