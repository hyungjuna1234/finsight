import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("dom test setup", () => {
  it("renders React components with jest-dom matchers", () => {
    render(<p>FinSight</p>);
    expect(screen.getByText("FinSight")).toBeInTheDocument();
    expect(globalThis.ResizeObserver).toBeDefined();
  });
});
