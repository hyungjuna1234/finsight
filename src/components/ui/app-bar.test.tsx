import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
import { chatStorageKey } from "@/components/chat/chat-storage";

import { AppBar } from "./app-bar";

it("전체 앱 내비게이션과 현재 페이지 및 로그아웃 폼을 표시한다", () => {
  render(<AppBar />);
  expect(screen.getByRole("link", { name: "FinSight" })).toHaveAttribute("href", "/dashboard");
  expect(screen.getByRole("link", { name: "대시보드" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "채팅" })).toHaveAttribute("href", "/chat");
  expect(screen.getByRole("button", { name: "로그아웃" }).closest("form")).toHaveAttribute("action", "/auth/signout");
});

it("로그아웃을 제출하면 이 탭의 채팅 기록을 지운다", () => {
  sessionStorage.setItem(chatStorageKey("user-1"), "[]");
  render(<AppBar />);
  const form = screen.getByRole("button", { name: "로그아웃" }).closest("form")!;
  form.addEventListener("submit", (event) => event.preventDefault());
  fireEvent.submit(form);
  expect(sessionStorage.getItem(chatStorageKey("user-1"))).toBeNull();
});
