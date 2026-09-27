import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { HowItWorks } from "./how-it-works";

it("shows the three ordered upload steps", () => {
  render(<HowItWorks />);
  expect(screen.getByRole("list").tagName).toBe("OL");
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  expect(screen.getByRole("link", { name: "받는 법" })).toHaveAttribute("href", "/guide");
  expect(screen.getByText(/한 달 총지출, 카테고리, 많이 쓴 곳 TOP5/)).toBeInTheDocument();
});
