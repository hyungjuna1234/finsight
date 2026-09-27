import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SiteHeader } from "./site-header";

it("shows the brand and public navigation", () => {
  render(<SiteHeader />);
  expect(screen.getByRole("link", { name: "FinSight" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "요금" })).toHaveAttribute("href", "/pricing");
  expect(screen.getByRole("link", { name: "가이드" })).toHaveAttribute("href", "/guide");
  expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute("href", "/login");
});
