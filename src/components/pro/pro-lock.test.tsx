import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProLock } from "./pro-lock";

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock("@vercel/analytics", () => ({ track }));

describe("ProLock", () => {
  beforeEach(() => track.mockClear());

  it("button variant는 Primary 가격 링크와 티저 이벤트를 제공한다", async () => {
    render(<ProLock from="chat" />);
    const link = screen.getByRole("link", { name: "Pro 시작하기" });
    expect(link).toHaveAttribute("href", "/pricing");
    expect(link).toHaveClass("bg-accent");
    await userEvent.click(link);
    expect(track).toHaveBeenCalledWith("pro_teaser_click", { from: "chat" });
  });

  it("link variant는 채움 배경 없는 Text 링크와 티저 이벤트를 제공한다", async () => {
    render(<ProLock from="comparison" variant="link" />);
    const link = screen.getByRole("link", { name: "Pro에서 보기 →" });
    expect(link).toHaveAttribute("href", "/pricing");
    expect(link).not.toHaveClass("bg-accent");
    expect(link).toHaveClass("text-accent");
    await userEvent.click(link);
    expect(track).toHaveBeenCalledWith("pro_teaser_click", { from: "comparison" });
  });
});
