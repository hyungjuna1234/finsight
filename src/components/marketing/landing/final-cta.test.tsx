import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));

import { FinalCta } from "./final-cta";

it("offers the final start and demo actions in the only accent section", () => {
  const { container } = render(<FinalCta />);
  const section = screen.getByRole("region", { name: "이번 달 지출, 파일 하나로 정리해 보세요" });

  expect(screen.getByRole("heading", { name: "이번 달 지출, 파일 하나로 정리해 보세요" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "무료로 시작" })).toHaveAttribute("href", "/login?next=%2Fupload");
  expect(screen.getByRole("link", { name: "예시 먼저 보기" })).toHaveAttribute("href", "/demo");
  expect(section).toHaveClass("bg-accent");
  expect(container.innerHTML).not.toContain("text-center");
});
