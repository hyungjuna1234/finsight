import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
import { AppBar } from "./app-bar";

it("전체 앱 내비게이션과 현재 페이지 및 로그아웃 폼을 표시한다", () => {
  render(<AppBar />);
  expect(screen.getByRole("link", { name: "FinSight" })).toHaveAttribute("href", "/dashboard");
  expect(screen.getByRole("link", { name: "대시보드" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "채팅" })).toHaveAttribute("href", "/chat");
  expect(screen.getByRole("button", { name: "로그아웃" }).closest("form")).toHaveAttribute("action", "/auth/signout");
});
