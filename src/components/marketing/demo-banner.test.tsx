import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DemoBanner } from "./demo-banner";

it("labels the sample and links to starting with user data", () => {
  const { container } = render(<DemoBanner />);
  expect(screen.getByText("샘플 데이터예요 · 실제 화면과 같아요")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "내 데이터로 시작" })).toHaveAttribute("href", "/login?next=%2Fupload");
  expect(container.firstElementChild).not.toHaveClass("text-center");
});
