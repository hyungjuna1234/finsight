import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExampleQuestions } from "./example-questions";

describe("ExampleQuestions", () => {
  it("uses buttons when interactive and plain list items for a teaser", async () => {
    const onPick = vi.fn();
    const { rerender } = render(<ExampleQuestions examples={["질문"]} onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: "질문" }));
    expect(onPick).toHaveBeenCalledWith("질문");
    rerender(<ExampleQuestions examples={["질문"]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("질문")).toBeInTheDocument();
  });
});
