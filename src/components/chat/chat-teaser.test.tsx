import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatTeaser } from "./chat-teaser";

describe("ChatTeaser", () => {
  it("shows read-only examples and a Pro link", () => {
    render(<ChatTeaser examples={["질문 예시"]} />);
    expect(screen.getByText("Pro에서 내 지출에 대해 물어볼 수 있어요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "질문 예시" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pro 시작하기" })).toHaveAttribute("href", "/pricing");
  });
});
