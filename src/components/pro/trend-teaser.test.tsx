import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TrendTeaser } from "./trend-teaser";
it("사용자 수치 없는 장식 차트와 잠금 안내를 표시한다", () => { const { container } = render(<TrendTeaser />); expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true"); expect(screen.getByRole("link", { name: "Pro 시작하기" })).toBeInTheDocument(); });
