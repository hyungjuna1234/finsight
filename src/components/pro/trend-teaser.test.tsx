import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrendTeaser } from "./trend-teaser";

describe("TrendTeaser", () => {
  it("기본값은 사용자 수치 없는 장식 차트와 Primary 잠금 안내다", () => {
    const { container } = render(<TrendTeaser />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("link", { name: "Pro 시작하기" })).toHaveClass("bg-accent");
  });

  it("link variant는 채움 배경 없는 잠금 링크다", () => {
    render(<TrendTeaser variant="link" />);
    expect(screen.getByRole("link", { name: "Pro에서 보기 →" })).not.toHaveClass("bg-accent");
  });
});
